import { APIGatewayProxyEvent, Context } from "aws-lambda";
import {
  response,
  NotFoundException,
  withErrorHandler,
} from "../utils/lambda-response";

const createPostHandler = async (
  event: APIGatewayProxyEvent,
  _context: Context
) => {
  const body = event.body ? JSON.parse(event.body) : {};

  if (!body.title) {
    throw new NotFoundException("Resource with ID 4 not found");
  }

  const newPost = {
    id: 1,
    title: body.title,
    content: body.content || "",
    createdAt: new Date().toISOString(),
  };

  return response(newPost);
};

export const handler = withErrorHandler(createPostHandler);
