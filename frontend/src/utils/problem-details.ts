import type { ProblemDetails } from '@/@types/api';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

const UNAVAILABLE_STATUSES = [404, 405, 502, 503, 504];

const isProblemDetails = (value: unknown): value is ProblemDetails =>
  typeof value === 'object' && value !== null && typeof (value as ProblemDetails).detail === 'string';

const isQueryError = (error: unknown): error is FetchBaseQueryError =>
  typeof error === 'object' && error !== null && 'status' in error;

/** True when the backend behind the gateway is missing or down (as opposed to rejecting the request). */
export const isServiceUnavailable = (error: unknown): boolean => {
  if (!isQueryError(error)) return false;
  switch (error.status) {
    case 'FETCH_ERROR':
    case 'TIMEOUT_ERROR':
      return true;
    case 'PARSING_ERROR':
      // The gateway answers a missing upstream with an HTML/empty body, which fails JSON parsing.
      return UNAVAILABLE_STATUSES.includes(error.originalStatus);
    case 'CUSTOM_ERROR':
      return false;
    default:
      return UNAVAILABLE_STATUSES.includes(error.status);
  }
};

/** Turns any RTK Query error into a user-facing message, preferring the server's ProblemDetails `detail`. */
export const getErrorMessage = (error: unknown): string => {
  if (!isQueryError(error)) return 'Ocurrió un error inesperado.';
  switch (error.status) {
    case 'FETCH_ERROR':
      return 'No se pudo conectar con el servidor.';
    case 'TIMEOUT_ERROR':
      return 'El servidor tardó demasiado en responder.';
    case 'CUSTOM_ERROR':
      return error.error;
    case 'PARSING_ERROR':
      return isServiceUnavailable(error)
        ? 'El servicio no está disponible por el momento.'
        : 'El servidor devolvió una respuesta inesperada.';
  }
  if (isProblemDetails(error.data)) {
    const { detail, errors } = error.data;
    return errors?.length ? `${detail}: ${errors.join(', ')}` : detail;
  }
  if (error.status === 429) return 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.';
  if (isServiceUnavailable(error)) return 'El servicio no está disponible por el momento.';
  return `Error inesperado (${error.status}).`;
};
