/**
 * Base class for custom HTTP errors
 */
export abstract class HttpError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean = true;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 400 Bad Request Error
 */
export class BadRequestException extends HttpError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized Error
 */
export class UnauthorizedException extends HttpError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

/**
 * 403 Forbidden Error
 */
export class ForbiddenException extends HttpError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

/**
 * 404 Not Found Error
 */
export class NotFoundException extends HttpError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

/**
 * 409 Conflict Error
 */
export class ConflictException extends HttpError {
  constructor(message: string = "Conflict") {
    super(message, 409);
  }
}

/**
 * 422 Unprocessable Entity Error
 */
export class UnprocessableEntityException extends HttpError {
  constructor(message: string = "Unprocessable Entity") {
    super(message, 422);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerException extends HttpError {
  constructor(message: string = "Internal Server Error") {
    super(message, 500);
  }
}

/**
 * 502 Bad Gateway Error
 */
export class BadGatewayException extends HttpError {
  constructor(message: string = "Bad Gateway") {
    super(message, 502);
  }
}

/**
 * 503 Service Unavailable Error
 */
export class ServiceUnavailableException extends HttpError {
  constructor(message: string = "Service Unavailable") {
    super(message, 503);
  }
}
