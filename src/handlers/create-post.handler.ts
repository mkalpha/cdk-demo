import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { response, NotFoundException, withErrorHandler } from "../utils";

// Your main handler logic (without error handling boilerplate)
const createPostHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
) => {
  // Example: Parse request body
  const body = event.body ? JSON.parse(event.body) : {};

  // Example business logic
  if (!body.title) {
    throw new NotFoundException("Resource with ID 4 not found");
  }

  // Example successful response
  const newPost = {
    id: 1,
    title: body.title,
    content: body.content || "",
    createdAt: new Date().toISOString(),
  };

  return response(newPost);
};

// Export the handler wrapped with error handling
export const handler = withErrorHandler(createPostHandler);
