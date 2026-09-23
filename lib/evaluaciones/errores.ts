/**
 * Error con status HTTP y código estable para la UI. Vive fuera de
 * `backend.ts` (que es `server-only`) para que la lógica compartida con los
 * scripts de verificación pueda lanzarlo.
 */
export class ErrorImportacion extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo: string,
  ) {
    super(message);
  }
}
