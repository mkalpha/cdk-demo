import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apiGateway from "aws-cdk-lib/aws-apigatewayv2";
import * as path from "path";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as apiGatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";

import {
  Duration,
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
  aws_rds as rds,
  aws_cloudwatch as cloudwatch,
} from "aws-cdk-lib";

export class CdkDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
    const requestMetric = api.metric("Count", {
      statistic: "Sum",
      period: Duration.minutes(5),
    });

    const errorMetric5XX = api.metric("5XXError", {
      statistic: "Sum",
      period: Duration.minutes(5),
    });

    const errorMetric4XX = api.metric("4XXError", {
      statistic: "Sum",
      period: Duration.minutes(5),
    });

    /**
     * Alerts
     */
    new cloudwatch.Alarm(this, "High5XXErrorRate", {
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

    /**
     * VPC
     * Creates a VPC with 3 available subnets,
     * Public
     * Private with Egress (outbound only)
     * Isolated Subnet (No internet in either direction)
     */
    const vpc = new ec2.Vpc(this, `rds-vpc`, {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
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
     * dbProxyGroup: security group to be attached to RDS Proxy. This group allows connection from any resources that belongs to lambdaGroup.
     * lambdaGroup: security group to be attached to Lambda.
     */
    const rdsGroup = new ec2.SecurityGroup(this, `rds-group`, {
      vpc,
      allowAllOutbound: true,
    });

    const dbProxyGroup = new ec2.SecurityGroup(this, "proxy-group", {
      vpc,
      allowAllOutbound: true,
    });

    const lambdaGroup = new ec2.SecurityGroup(this, "lambda-group", {
      vpc,
      allowAllOutbound: true,
    });

    rdsGroup.addIngressRule(
      dbProxyGroup,
      ec2.Port.tcp(5432),
      "allow proxy to rds connection"
    );

    dbProxyGroup.addIngressRule(
      lambdaGroup,
      ec2.Port.tcp(5432),
      "allow lambda to proxy connection"
    );

    /**
     * Secrets Manager - Generates DB Secret
     */
    const dbAdminSecret = new secretsmanager.Secret(
      this,
      "database-admin-secret",
      {
        secretName: `dbAdminLoginInfo`,
        generateSecretString: {
          excludeCharacters: ":@/\" '",
          generateStringKey: "password",
          passwordLength: 21,
          secretStringTemplate: '{"username": "postgres"}',
        },
      }
    );

    new ec2.InterfaceVpcEndpoint(this, "secret-manager-vpc-endpoint", {
      vpc: vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
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
      readers: [
        rds.ClusterInstance.serverlessV2(`${dbInstanceIdentifier}-reader`, {
          scaleWithWriter: true,
        }),
      ],
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
      credentials: rds.Credentials.fromSecret(dbAdminSecret),
      deletionProtection: false,
      iamAuthentication: false,
      instanceIdentifierBase: dbInstanceIdentifier,
      preferredMaintenanceWindow: "Sat:17:00-Sat:17:30",
      storageEncrypted: true,
    });

    /**
     * RDS Proxy
     */
    const proxy = dbCluster.addProxy("rds-proxy", {
      secrets: [dbAdminSecret],
      debugLogging: true,
      vpc: vpc,
      securityGroups: [dbProxyGroup],
    });

    /**
     * Lambda Functions
     */
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
        environment: {
          DATABASE_ENDPOINT: proxy.endpoint,
          DATABASE_NAME: "postgres",
          SECRET_NAME: dbAdminSecret.secretName,
          ENV: process.env.ENV ?? "dev",
        },
        vpc: vpc,
        securityGroups: [lambdaGroup],
      }
    );

    dbAdminSecret.grantRead(createPostFunction);
    proxy.grantConnect(createPostFunction);

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
