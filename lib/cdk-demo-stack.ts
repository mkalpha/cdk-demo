import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";

export class CdkDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apiGateway.RestApi(this, "DemoApiGateway", {
      restApiName: "demo-api",
      deployOptions: {
        metricsEnabled: true,
        loggingLevel: apiGateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      cloudWatchRole: true,
    });

    const createPostFunction = new lambda.NodejsFunction(
      this,
      "CreatePostFunction",
      {
        entry: path.resolve(
          __dirname,
          "../src/handlers/create-post.handler.ts"
        ),
        functionName: `${process.env.STAGE ?? "dev"}-cdk-demo-create-post`,
        handler: "handler",
        memorySize: 512,
        runtime: Runtime.NODEJS_22_X,
        timeout: cdk.Duration.seconds(60),
        bundling: {
          target: "es2020",
        },
      }
    );

    const createPostLambdaIntegration = new apiGateway.LambdaIntegration(
      createPostFunction
    );

    const demoPostResource = api.root.addResource("posts");
    demoPostResource.addMethod("POST", createPostLambdaIntegration);
  }
}
