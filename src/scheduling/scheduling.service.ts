import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseISO } from "date-fns";

import { CatalogService } from "../catalog/catalog.service";
import { toHydrationFailedException, toReadResourceError, toWriteResourceError } from "../catalog/catalog.helpers";
import { CodeErrorEnum } from "../common/constants/code-error.enum";
import { HttpValidationPipe } from "../common/http-validation.pipe";
import { ReservationsService } from "../reservations/reservations.service";
import {
  findIntent,
  mergeReservation,
  reservationFingerprint,
  sameReservationIntent,
} from "../reservations/reservation.helpers";
import type { IReservation, IReservationPatch, IReservationWrite } from "../reservations/interfaces/index";
import { PatchReservationDto } from "./dto/patch-reservation";
import { hydrateReservation } from "./hydrate-reservation";
import { IdempotencyStore } from "./idempotency-store";
import type {
  IHydratedReservation,
  IReservationConflict,
  IReservationListQuery,
  IResourceUtilisation,
  IUtilisationQuery,
} from "./interfaces/index";
import { KeyedMutex } from "./keyed-mutex";
import { bookedMinutes, busyMinutes, clipInterval, minutesBetween, peakConcurrency } from "./utilisation";
import { windowsOverlap } from "./windows-overlap";

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);
  private readonly resourceLocks = new KeyedMutex<number>();
  private readonly idempotency: IdempotencyStore<IHydratedReservation>;

  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly catalogService: CatalogService,
    private readonly validationPipe: HttpValidationPipe,
    configService: ConfigService,
  ) {
    this.idempotency = new IdempotencyStore(~~configService.get<string>("IDEMPOTENCY_TTL_MS", "600000"));
  }

  async getReservation(id: number): Promise<IHydratedReservation> {
    const reservation = await this.reservationsService.getById(id);
    const [hydrated] = await this.hydratePage([reservation]);
    return hydrated!;
  }

  async listReservations(query: IReservationListQuery): Promise<[IHydratedReservation[], number]> {
    const listed = await this.reservationsService.list(query.resourceId);
    const matched = listed.filter(reservation => this.matchesWindow(reservation, query.from, query.to));
    matched.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);

    const count = matched.length;
    const page = matched.slice(query.skip, query.skip + query.take);
    const rows = await this.hydratePage(page);
    return [rows, count];
  }

  async getResourceUtilisation(resourceId: number, query: IUtilisationQuery): Promise<IResourceUtilisation> {
    const from = parseISO(query.from);
    const to = parseISO(query.to);
    const resource = await this.catalogService.getById(resourceId).catch(toReadResourceError);
    const listed = await this.reservationsService.list(resourceId);
    const overlapping = listed.filter(reservation => this.matchesWindow(reservation, query.from, query.to));
    const clipped = overlapping.flatMap(reservation => {
      const interval = clipInterval(parseISO(reservation.startsAt), parseISO(reservation.endsAt), from, to);
      return interval === undefined ? [] : [interval];
    });
    const window = minutesBetween(from, to);
    const busy = busyMinutes(clipped);

    return {
      resourceId: resource.id,
      resource: {
        name: resource.name,
        kind: resource.kind,
        capacity: resource.capacity,
        timezone: resource.timezone,
      },
      from: query.from,
      to: query.to,
      windowMinutes: window,
      bookedMinutes: bookedMinutes(clipped),
      busyMinutes: busy,
      utilisation: busy / window,
      distinctHolders: new Set(overlapping.map(reservation => reservation.holder)).size,
      reservationCount: overlapping.length,
      peakConcurrency: peakConcurrency(clipped),
    };
  }

  async createReservation(body: IReservationWrite, idempotencyKey?: string): Promise<IHydratedReservation> {
    const fingerprint = reservationFingerprint(body);
    const cached = this.replayIdempotency(idempotencyKey, fingerprint);
    if (cached) {
      return cached;
    }

    return this.withResourceLocks([body.resourceId], async () => {
      const replay = this.replayIdempotency(idempotencyKey, fingerprint);
      if (replay) {
        return replay;
      }

      const resource = await this.catalogService.getById(body.resourceId).catch(toWriteResourceError);
      const listed = await this.reservationsService.list(body.resourceId);
      const existing = findIntent(listed, body);
      if (existing) {
        return this.remember(idempotencyKey, fingerprint, hydrateReservation(existing, resource));
      }

      this.assertNoOverlap(listed, body);
      const created = await this.reservationsService.createConfirmed(body);
      this.logger.log(`Created reservation ${created.id} for resource ${body.resourceId}`);
      return this.remember(idempotencyKey, fingerprint, hydrateReservation(created, resource));
    });
  }

  async replaceReservation(
    id: number,
    body: IReservationWrite,
    idempotencyKey?: string,
  ): Promise<IHydratedReservation> {
    const fingerprint = `put:${id}:${reservationFingerprint(body)}`;
    const cached = this.replayIdempotency(idempotencyKey, fingerprint);
    if (cached) {
      return cached;
    }

    return this.withFreshReservation(
      id,
      () => [body.resourceId],
      async current => {
        const hydrated = await this.commitMutation(id, current, body, idempotencyKey, fingerprint, () =>
          this.reservationsService.replaceConfirmed(id, body),
        );
        this.logger.log(`Replaced reservation ${id}`);
        return hydrated;
      },
    );
  }

  async patchReservation(id: number, patch: IReservationPatch, idempotencyKey?: string): Promise<IHydratedReservation> {
    return this.withFreshReservation(
      id,
      current => [mergeReservation(current, patch).resourceId],
      async current => {
        const intended = mergeReservation(current, patch);
        await this.assertWindow(intended);
        const fingerprint = `patch:${id}:${reservationFingerprint(intended)}`;
        const hydrated = await this.commitMutation(
          id,
          current,
          intended,
          idempotencyKey,
          fingerprint,
          () => this.reservationsService.patchConfirmed(id, patch, intended),
          false,
        );
        this.logger.log(`Patched reservation ${id}`);
        return hydrated;
      },
    );
  }

  async cancelReservation(id: number): Promise<void> {
    await this.withFreshReservation(
      id,
      () => [],
      current => this.reservationsService.removeConfirmed(current.id),
      () => undefined,
    );
    this.logger.log(`Cancelled reservation ${id}`);
  }

  private async commitMutation(
    id: number,
    current: IReservation,
    intended: IReservationWrite,
    idempotencyKey: string | undefined,
    fingerprint: string,
    write: () => Promise<IReservation>,
    checkOverlap = true,
  ): Promise<IHydratedReservation> {
    const replay = this.replayIdempotency(idempotencyKey, fingerprint);
    if (replay) {
      return replay;
    }

    const resource = await this.catalogService.getById(intended.resourceId).catch(toWriteResourceError);
    if (checkOverlap) {
      const listed = await this.reservationsService.list(intended.resourceId);
      this.assertNoOverlap(listed, intended, id);
    }

    const written = sameReservationIntent(current, intended) ? current : await write();
    return this.remember(idempotencyKey, fingerprint, hydrateReservation(written, resource));
  }

  private async withFreshReservation<T>(
    id: number,
    extraIds: (row: IReservation) => number[],
    work: (current: IReservation) => Promise<T>,
    onGone?: () => T,
  ): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const snapshot = await this.reservationsService.findById(id);
      if (!snapshot) {
        return this.ifMissing(onGone);
      }

      const lockIds = [snapshot.resourceId, ...extraIds(snapshot)];
      const held = new Set(this.normalizedLockIds(lockIds));

      const outcome = await this.withResourceLocks(lockIds, async () => {
        const current = await this.reservationsService.findById(id);
        if (!current) {
          return { retry: false as const, value: this.ifMissing(onGone) };
        }

        const needed = this.normalizedLockIds([current.resourceId, ...extraIds(current)]);
        if (needed.some(resourceId => !held.has(resourceId))) {
          return { retry: true as const };
        }

        return { retry: false as const, value: await work(current) };
      });

      if (!outcome.retry) {
        return outcome.value;
      }
    }

    throw this.conflict("Reservation resource changed during update");
  }

  private ifMissing<T>(onGone?: () => T): T {
    if (onGone) {
      return onGone();
    }
    throw new NotFoundException();
  }

  private conflict(message: string, extra: Record<string, unknown> = {}): ConflictException {
    return new ConflictException({
      statusCode: 409,
      error: "Conflict",
      message,
      ...extra,
    });
  }

  private normalizedLockIds(ids: number[]): number[] {
    return [...new Set(ids)].sort((a, b) => a - b);
  }

  private withResourceLocks<T>(ids: number[], work: () => Promise<T>): Promise<T> {
    const unique = this.normalizedLockIds(ids);
    const run = (index: number): Promise<T> => {
      if (index >= unique.length) {
        return work();
      }
      return this.resourceLocks.run(unique[index]!, () => run(index + 1));
    };
    return run(0);
  }

  private replayIdempotency(key: string | undefined, fingerprint: string): IHydratedReservation | undefined {
    if (!key) {
      return undefined;
    }
    const hit = this.idempotency.get(key);
    if (!hit) {
      return undefined;
    }
    if (hit.fingerprint !== fingerprint) {
      throw this.conflict("Idempotency-Key was reused with a different body", {
        code: CodeErrorEnum.IDEMPOTENCY_KEY_REUSE,
      });
    }
    return hit.value;
  }

  private remember(key: string | undefined, fingerprint: string, value: IHydratedReservation): IHydratedReservation {
    if (key) {
      this.idempotency.set(key, fingerprint, value);
    }
    return value;
  }

  private assertNoOverlap(listed: IReservation[], body: IReservationWrite, excludeId?: number): void {
    const conflicts = listed.filter(row => {
      if (excludeId !== undefined && row.id === excludeId) {
        return false;
      }
      return windowsOverlap(
        parseISO(body.startsAt),
        parseISO(body.endsAt),
        parseISO(row.startsAt),
        parseISO(row.endsAt),
      );
    });
    if (conflicts.length > 0) {
      throw this.conflict("Reservation overlaps an existing reservation", {
        code: CodeErrorEnum.OVERLAP,
        conflicts: conflicts.map((row): IReservationConflict => ({
          id: row.id,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
        })),
      });
    }
  }

  private async assertWindow(body: IReservationWrite): Promise<void> {
    await this.validationPipe.transform(
      { startsAt: body.startsAt, endsAt: body.endsAt },
      { type: "body", metatype: PatchReservationDto },
    );
  }

  private matchesWindow(reservation: IReservation, from?: string, to?: string): boolean {
    if (from === undefined || to === undefined) {
      return true;
    }
    return windowsOverlap(parseISO(reservation.startsAt), parseISO(reservation.endsAt), parseISO(from), parseISO(to));
  }

  private async hydratePage(reservations: IReservation[]): Promise<IHydratedReservation[]> {
    const ids = [...new Set(reservations.map(reservation => reservation.resourceId))];
    const resources = await Promise.all(
      ids.map(id => this.catalogService.getById(id).catch(toHydrationFailedException)),
    );
    const byId = new Map(ids.map((id, index) => [id, resources[index]!]));
    return reservations.map(reservation => hydrateReservation(reservation, byId.get(reservation.resourceId)!));
  }
}
