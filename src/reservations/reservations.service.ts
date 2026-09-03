import { BadGatewayException, GatewayTimeoutException, Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import type { AxiosRequestConfig } from "axios";
import { firstValueFrom } from "rxjs";

import { isNotFound, isUncertainWrite, parseUpstream } from "../common/http/helpers";
import { ReservationDto } from "./dto/index";
import type { IReservation, IReservationPatch, IReservationWrite } from "./interfaces/index";
import { findIntent, sameReservationIntent } from "./reservation.helpers";

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(private readonly httpService: HttpService) {}

  async getById(id: number): Promise<IReservation> {
    return this.send({ method: "GET", url: `/${id}` });
  }

  async findById(id: number): Promise<IReservation | undefined> {
    return this.getById(id).catch(error => {
      if (isNotFound(error)) {
        return undefined;
      }
      throw error;
    });
  }

  async list(resourceId?: number): Promise<IReservation[]> {
    const response = await firstValueFrom(
      this.httpService.request<unknown>({
        method: "GET",
        url: "/",
        params: resourceId === undefined ? undefined : { resourceId },
      }),
    );
    const payload = response.data;
    if (!Array.isArray(payload)) {
      throw new BadGatewayException("Malformed upstream payload");
    }
    return Promise.all(payload.map(item => parseUpstream(ReservationDto, item)));
  }

  async create(body: IReservationWrite): Promise<IReservation> {
    return this.send({ method: "POST", url: "/", data: body });
  }

  async replace(id: number, body: IReservationWrite): Promise<IReservation> {
    return this.send({ method: "PUT", url: `/${id}`, data: body });
  }

  async patch(id: number, body: IReservationPatch): Promise<IReservation> {
    return this.send({ method: "PATCH", url: `/${id}`, data: body });
  }

  async remove(id: number): Promise<void> {
    await firstValueFrom(this.httpService.delete(`/${id}`)).catch(error => {
      if (!isNotFound(error)) {
        throw error;
      }
    });
  }

  async createConfirmed(body: IReservationWrite): Promise<IReservation> {
    return this.confirmWrite(this.create(body), `Uncertain create for resource ${body.resourceId}`, async () => {
      const found = findIntent(await this.list(body.resourceId), body);
      if (!found) {
        throw new GatewayTimeoutException("Reservation create did not confirm");
      }
      return found;
    });
  }

  async replaceConfirmed(id: number, body: IReservationWrite): Promise<IReservation> {
    return this.confirmWrite(this.replace(id, body), `Uncertain replace of reservation ${id}`, () =>
      this.requireIntent(id, body, "Reservation replace did not confirm"),
    );
  }

  async patchConfirmed(id: number, patch: IReservationPatch, intended: IReservationWrite): Promise<IReservation> {
    return this.confirmWrite(this.patch(id, patch), `Uncertain patch of reservation ${id}`, () =>
      this.requireIntent(id, intended, "Reservation patch did not confirm"),
    );
  }

  async removeConfirmed(id: number): Promise<void> {
    return this.confirmWrite(this.remove(id), `Uncertain cancel of reservation ${id}`, async () => {
      if (await this.findById(id)) {
        throw new GatewayTimeoutException("Reservation cancel did not confirm");
      }
    });
  }

  private async send(config: AxiosRequestConfig): Promise<IReservation> {
    const response = await firstValueFrom(this.httpService.request<unknown>(config));
    return await parseUpstream(ReservationDto, response.data);
  }

  private confirmWrite<T>(work: Promise<T>, warning: string, recover: () => Promise<T>): Promise<T> {
    return work.catch(error => {
      if (!isUncertainWrite(error)) {
        throw error;
      }
      this.logger.warn(warning);
      return recover();
    });
  }

  private async requireIntent(id: number, intended: IReservationWrite, message: string): Promise<IReservation> {
    const current = await this.findById(id);
    if (current && sameReservationIntent(current, intended)) {
      return current;
    }
    throw new GatewayTimeoutException(message);
  }
}
