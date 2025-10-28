import { APIGatewayProxyEvent, Context } from "aws-lambda";
import {
  response,
  responseWithStatus,
  NotFoundException,
  BadRequestException,
  withErrorHandler,
} from "../utils";

interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  createdAt: string;
}

// Mock data store
const posts: Post[] = [
  {
    id: 1,
    title: "First Post",
    content: "This is the first post",
    authorId: 1,
    createdAt: "2024-01-01T00:00:00Z",
  },
];

const getPostHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
) => {
  const postId = event.pathParameters?.id;

  if (!postId) {
    throw new BadRequestException("Post ID is required");
  }

  const id = parseInt(postId, 10);

  if (isNaN(id)) {
    throw new BadRequestException("Post ID must be a valid number");
  }

  const post = posts.find((p) => p.id === id);

  if (!post) {
    throw new NotFoundException(`Post with ID ${id} not found`);
  }

  // Return successful response
  return response(post);
};

// Export the handler wrapped with error handling
export const handler = withErrorHandler(getPostHandler);
