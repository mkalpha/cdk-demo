import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apiGateway from "aws-cdk-lib/aws-apigatewayv2";
import * as path from "path";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, Architecture } from "aws-cdk-lib/aws-lambda";
import * as apiGatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";

import {
  Duration,
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_rds as rds,
  aws_cloudwatch as cloudwatch,
  aws_ssm as ssm,
} from "aws-cdk-lib";

export class CdkDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Service-Linked Role for RDS
     * This is required for RDS to manage resources
     */
    new iam.CfnServiceLinkedRole(this, "RDSServiceLinkedRole", {
      awsServiceName: "rds.amazonaws.com",
    });

    /**
     * API Gateway
     */
    const api = new apiGateway.HttpApi(this, "RecipeApiGateway", {
      apiName: "recipe-api",
      description: "Recipe API using HTTP API Gateway v2",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apiGateway.CorsHttpMethod.GET,
          apiGateway.CorsHttpMethod.POST,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    /**
     * Metrics
     */
    const requestMetric = api.metric(`${api.httpApiName}-Count`, {
      statistic: "Sum",
      period: Duration.minutes(5),
    });

    const errorMetric5XX = api.metric(`${api.httpApiName}-5XXError`, {
      statistic: "Sum",
      period: Duration.minutes(5),
    });

    const errorMetric4XX = api.metric(`${api.httpApiName}-4XXError`, {
      statistic: "Sum",
      period: Duration.minutes(5),
    });

    const successMetric2XX = api.metric(`${api.httpApiName}-2XXSuccess`, {
      statistic: "Sum",
      period: Duration.minutes(5),
    });

    /**
     * Alerts
     */
    new cloudwatch.Alarm(this, `${api.httpApiName}-High5XXErrorRate`, {
      metric: errorMetric5XX,
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    /**
     * Monitoring
     */
    const dashboard = new cloudwatch.Dashboard(this, "RecipeApiDashboard", {
      dashboardName: "recipe-api-dashboard",
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API Request Count",
        left: [requestMetric],
        width: 12,
        height: 6,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API 5XX Errors",
        left: [errorMetric5XX],
        width: 12,
        height: 6,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API 4XX Errors",
        left: [errorMetric4XX],
        width: 12,
        height: 6,
      })
    );
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API 2XX Success",
        left: [successMetric2XX],
        width: 12,
        height: 6,
      })
    );

    /**
     * VPC
     * Creates a VPC with 2 available subnets,
     * Public
     * Isolated Subnet (No internet in either direction)
     */
    const vpc = new ec2.Vpc(this, `rds-vpc`, {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: "Isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    /**
     * Security Groups
     * rdsGroup: security group to be attached to RDS. This group allows connection from any resources that belongs to dbProxyGroup.
     * lambdaGroup: security group to be attached to Lambda.
     */
    const rdsGroup = new ec2.SecurityGroup(this, `rds-group`, {
      vpc,
      allowAllOutbound: true,
    });

    const lambdaGroup = new ec2.SecurityGroup(this, "lambda-group", {
      vpc,
      allowAllOutbound: true,
    });

    rdsGroup.addIngressRule(
      lambdaGroup,
      ec2.Port.tcp(5432),
      "allow lambda to rds connection"
    );

    /**
     * Parameter Store - Reference existing DB Password
     */
    const dbPassword = ssm.StringParameter.fromStringParameterName(
      this,
      "database-password",
      "/cdk-demo/database/password"
    );

    new ec2.InterfaceVpcEndpoint(this, "systems-manager-vpc-endpoint", {
      vpc: vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });

    /**
     * RDS Cluster
     */
    const dbClusterIdentifier = "rds-cluster";
    const dbInstanceIdentifier = "rds-instance";

    const subnetGroupName = `rds-subnet-group`.toLowerCase();
    const subnetGroup = new rds.SubnetGroup(this, subnetGroupName, {
      description: subnetGroupName,
      vpc,
      subnetGroupName: subnetGroupName,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }),
    });

    const dbCluster = new rds.DatabaseCluster(this, dbClusterIdentifier, {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_3,
      }),
      vpc: vpc,
      securityGroups: [rdsGroup],
      subnetGroup: subnetGroup,
      enableDataApi: true,
      writer: rds.ClusterInstance.serverlessV2(
        `${dbInstanceIdentifier}-writer`
      ),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      backup: {
        retention: Duration.days(1),
        preferredWindow: "16:00-16:30",
      },
      cloudwatchLogsExports: ["postgresql"],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_DAY,
      clusterIdentifier: dbClusterIdentifier,
      copyTagsToSnapshot: true,
      credentials: rds.Credentials.fromUsername("postgres", {
        /**
         * Cloudformation does not support ssm SECURE_STRING parameters
         * So you cannot do password: cdk.SecretValue.ssmSecure("/cdk-demo/database/password"),
         * In production you would use Secrets manager instead of ssm (ssm is free)
         */
        password: cdk.SecretValue.unsafePlainText(dbPassword.stringValue),
      }),
      deletionProtection: false,
      iamAuthentication: false,
      instanceIdentifierBase: dbInstanceIdentifier,
      preferredMaintenanceWindow: "Sat:17:00-Sat:17:30",
      storageEncrypted: true,
    });

    /**
     * Lambda Functions
     */

    const createPostLogGroup = new logs.LogGroup(this, "CreatePostLogGroup", {
      logGroupName: `/aws/lambda/${
        process.env.STAGE ?? "dev"
      }-cdk-demo-create-post`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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
        architecture: Architecture.ARM_64,
        logGroup: createPostLogGroup,
        timeout: cdk.Duration.seconds(60),
        bundling: {
          target: "es2020",
        },
        environment: {
          DATABASE_ENDPOINT: dbCluster.clusterEndpoint.socketAddress,
          DATABASE_NAME: "postgres",
          DATABASE_PASSWORD_PARAMETER: "/cdk-demo/database/password", // Reference the parameter name
          ENV: process.env.ENV ?? "dev",
        },
        vpc: vpc,
        securityGroups: [lambdaGroup],
      }
    );

    dbPassword.grantRead(createPostFunction);

    const createPostIntegration =
      new apiGatewayv2Integrations.HttpLambdaIntegration(
        "CreatePostIntegration",
        createPostFunction
      );

    api.addRoutes({
      path: "/posts",
      methods: [apiGateway.HttpMethod.POST],
      integration: createPostIntegration,
    });
  }
}
