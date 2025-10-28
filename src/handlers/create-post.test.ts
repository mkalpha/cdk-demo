import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { handler } from "./create-post.handler";

// Mock context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test-function",
  functionVersion: "1",
  invokedFunctionArn:
    "arn:aws:lambda:us-east-1:123456789012:function:test-function",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test-function",
  logStreamName: "test-stream",
  getRemainingTimeInMillis: () => 5000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe("Create Post Handler", () => {
  it("should return 404 when title is missing", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({}),
      headers: {},
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/posts",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: "",
    };

    const result = (await handler(
      event as APIGatewayProxyEvent,
      mockContext,
      () => {}
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(404);
    expect(result.headers?.["Content-Type"]).toBe("application/json");

    const body = JSON.parse(result.body);
    expect(body.error).toBe(true);
    expect(body.message).toBe("Resource with ID 4 not found");
    expect(body.statusCode).toBe(404);
  });

  it("should create a post when valid data is provided", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({
        title: "Test Post",
        content: "This is a test post",
      }),
      headers: {},
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/posts",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: "",
    };

    const result = (await handler(
      event as APIGatewayProxyEvent,
      mockContext,
      () => {}
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Content-Type"]).toBe("application/json");

    const body = JSON.parse(result.body);
    expect(body.id).toBe(1);
    expect(body.title).toBe("Test Post");
    expect(body.content).toBe("This is a test post");
    expect(body.createdAt).toBeDefined();
  });
});
