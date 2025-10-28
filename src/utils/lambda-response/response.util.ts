import { APIGatewayProxyResult } from "aws-lambda";

/**
 * Standard response structure for API Gateway Lambda functions
 */
export interface LambdaResponse {
  statusCode: number;
  headers: { "Content-Type": "application/json" };
  body: string;
}

/**
 * Creates a successful response with status code 200
 * @param data - Any data to be returned in the response body
 * @returns Formatted Lambda response
 */
export function response<T>(data: T): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

/**
 * Creates an error response with the specified status code
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @returns Formatted Lambda error response
 */
export function errorResponse(
  statusCode: number,
  message: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: true,
      message,
      statusCode,
    }),
  };
}

/**
 * Creates a success response with custom status code
 * @param statusCode - HTTP status code
 * @param data - Data to be returned
 * @returns Formatted Lambda response
 */
export function responseWithStatus<T>(
  statusCode: number,
  data: T
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
