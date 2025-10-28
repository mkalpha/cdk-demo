# Lambda Response Utilities

This utility provides a clean and consistent way to handle AWS Lambda responses and custom errors.

## Features

- ✅ Consistent response format for all Lambda functions
- ✅ Custom HTTP error classes with proper status codes
- ✅ Automatic error handling middleware
- ✅ Type-safe response utilities
- ✅ Easy to test and maintain

## Quick Start

### 1. Basic Response Utility

```typescript
import { response } from "../utils";

// Simple success response
return response({ message: "Hello World" });
// Returns: { statusCode: 200, headers: { "Content-Type": "application/json" }, body: '{"message":"Hello World"}' }
```

### 2. Custom Error Classes

```typescript
import { NotFoundException, BadRequestException } from "../utils";

// Throw custom errors
throw new NotFoundException("User not found");
throw new BadRequestException("Invalid input data");
```

### 3. Error Handler Middleware

```typescript
import { withErrorHandler } from "../utils";

const myHandler = async (event, context) => {
  // Your business logic here
  throw new NotFoundException("Resource not found");
};

// Wrap your handler with automatic error handling
export const handler = withErrorHandler(myHandler);
```

## Available Error Classes

| Error Class                    | Status Code | Default Message         |
| ------------------------------ | ----------- | ----------------------- |
| `BadRequestException`          | 400         | "Bad Request"           |
| `UnauthorizedException`        | 401         | "Unauthorized"          |
| `ForbiddenException`           | 403         | "Forbidden"             |
| `NotFoundException`            | 404         | "Resource not found"    |
| `ConflictException`            | 409         | "Conflict"              |
| `UnprocessableEntityException` | 422         | "Unprocessable Entity"  |
| `InternalServerException`      | 500         | "Internal Server Error" |
| `BadGatewayException`          | 502         | "Bad Gateway"           |
| `ServiceUnavailableException`  | 503         | "Service Unavailable"   |

## Complete Example

```typescript
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import {
  response,
  responseWithStatus,
  NotFoundException,
  BadRequestException,
  withErrorHandler,
} from "../utils";

interface User {
  id: number;
  name: string;
  email: string;
}

const getUserHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
) => {
  const userId = event.pathParameters?.id;

  if (!userId) {
    throw new BadRequestException("User ID is required");
  }

  const id = parseInt(userId, 10);

  if (isNaN(id)) {
    throw new BadRequestException("User ID must be a valid number");
  }

  // Simulate database lookup
  const user = await findUserById(id);

  if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }

  // Return successful response
  return response(user);
};

// Export the handler wrapped with error handling
export const handler = withErrorHandler(getUserHandler);
```

## Response Formats

### Success Response

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"id\":1,\"name\":\"John Doe\",\"email\":\"john@example.com\"}"
}
```

### Error Response

```json
{
  "statusCode": 404,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"error\":true,\"message\":\"User with ID 5 not found\",\"statusCode\":404}"
}
```

## Advanced Usage

### Custom Status Codes

```typescript
import { responseWithStatus } from "../utils";

// Return 201 Created
return responseWithStatus(201, { id: 1, message: "Created successfully" });
```

### Creating Custom Errors

```typescript
import { HttpError } from "../utils";

class CustomBusinessException extends HttpError {
  constructor(message: string = "Business rule violation") {
    super(message, 422);
  }
}

// Usage
throw new CustomBusinessException("Cannot delete user with active orders");
```

### Manual Error Responses

```typescript
import { errorResponse } from "../utils";

// Manual error response without throwing
if (someCondition) {
  return errorResponse(429, "Rate limit exceeded");
}
```

## Testing

The utilities make testing Lambda functions much easier:

```typescript
import { handler } from "../src/handlers/my-handler";

test("should return 404 for missing resource", async () => {
  const event = {
    /* mock event */
  };
  const context = {
    /* mock context */
  };

  const result = await handler(event, context, () => {});

  expect(result.statusCode).toBe(404);
  expect(JSON.parse(result.body).message).toBe("Resource not found");
});
```

## Best Practices

1. **Always use the error handler wrapper** - It ensures consistent error responses
2. **Use specific error classes** - They provide better debugging information
3. **Include meaningful error messages** - Help with debugging and user experience
4. **Type your response data** - Use interfaces for better type safety
5. **Test error scenarios** - Ensure your error handling works as expected

## Migration from Manual Response Handling

### Before

```typescript
export const handler = async (event) => {
  try {
    // business logic
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### After

```typescript
const myHandler = async (event) => {
  // business logic - throws errors naturally
  return response(result);
};

export const handler = withErrorHandler(myHandler);
```
