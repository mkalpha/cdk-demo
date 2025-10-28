import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { HttpError } from "./errors.util";
import { errorResponse } from "./response.util";

/**
 * Type definition for a Lambda handler function
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

/**
 * Higher-order function that wraps a Lambda handler with error handling
 * @param handler - The Lambda handler function to wrap
 * @returns Wrapped handler with automatic error handling
 */
export function withErrorHandler(
  handler: LambdaHandler
): APIGatewayProxyHandler {
  return async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error("Lambda handler error:", error);

      // Handle custom HTTP errors
      if (error instanceof HttpError) {
        return errorResponse(error.statusCode, error.message);
      }

      // Handle validation errors (common with libraries like Joi, Yup, etc.)
      if (error instanceof Error && error.name === "ValidationError") {
        return errorResponse(400, error.message);
      }

      // Handle unknown errors
      if (error instanceof Error) {
        return errorResponse(
          500,
          process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : error.message
        );
      }

      // Fallback for non-Error objects
      return errorResponse(500, "An unexpected error occurred");
    }
  };
}
