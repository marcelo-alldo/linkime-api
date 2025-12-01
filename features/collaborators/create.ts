import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import * as bcrypt from "bcryptjs";
import { generateRandomString } from "../../utils/generateRandomString";
import { RoleFeature } from "@prisma/client";
import { sign } from "jsonwebtoken";
import * as AWS from "aws-sdk";
import { subscription } from "../middlewares/subscription.middleware";

const sqs = new AWS.SQS({ region: "us-east-1" });

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };
  // Parse all possible fields from body
  const { email, name, phone, cpf, birthDate } = JSON.parse(event.body || "{}");
  // LOG: Received parameters
  console.log("Received parameters:", {
    email,
    name,
    phone,
    cpf,
    birthDate,
  });

  try {
    if (!authorization) {
      console.error(
        "COLLABORATOR CREATE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error(
        "COLLABORATOR CREATE ERROR: Assinatura inválida ou expirada."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const userSubscription = await database.client.userSubscription.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        status: {
          in: ["ACTIVE", "TRIAL"],
        },
      },
      include: {
        subscription: true,
      },
    });

    if (!userSubscription) {
      console.error(
        "COLLABORATOR CREATE ERROR: Assinatura do usuário não encontrada."
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura do usuário não encontrada.",
        }),
      };
    }

    const collaboratorsCount = await database.client.collaborator.count({
      where: {
        parentUid: authorization.data.masterUid,
        user: {
          enable: true,
        },
      },
    });

    let collaboratorLimit = 0;

    if (userSubscription.status === "TRIAL") {
      collaboratorLimit = 1;
    } else {
      switch (userSubscription.subscriptionUid) {
        case process.env.SUBSCRIPTION_SERVICE_UID:
          collaboratorLimit = 5;
          break;
        case process.env.SUBSCRIPTION_DEFAULT_UID:
          collaboratorLimit = 10;
          break;
        case process.env.SUBSCRIPTION_CUSTOM_UID:
          collaboratorLimit = 20;
          break;
        default:
          collaboratorLimit = 1;
          break;
      }
    }

    if (collaboratorsCount >= collaboratorLimit) {
      const limitMessage =
        userSubscription.status === "TRIAL"
          ? "Sua assinatura de teste permite apenas 1 cadastro de colaborador."
          : `Sua assinatura permite apenas ${collaboratorLimit} colaboradores cadastrados.`;

      console.error(
        `COLLABORATOR CREATE ERROR: Limite de colaboradores atingido. Atual: ${collaboratorsCount}, Limite: ${collaboratorLimit}`
      );
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: limitMessage,
        }),
      };
    }

    // Only name and phone are required
    if (!name || !email) {
      console.error(
        "COLLABORATOR CREATE ERROR: Campos obrigatórios não informados (nome, e-mail)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (nome, e-mail).",
        }),
      };
    }

    const alreadyUser = await database.client.dataProfile.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    console.log("ALREADY DATA PROFILE EXIST", alreadyUser);

    const activationCode = generateRandomString(20);

    if (alreadyUser) {
      console.error(
        "COLLABORATOR CREATE ERROR: Já existe um usuário cadastrado com e-mail ou telefone informado."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Já existe um usuário cadastrado com e-mail ou telefone informado.",
        }),
      };
    }

    const temporaryPassword = generateRandomString(10);

    let user, userFeatures;
    await database.client.$transaction(async (prisma) => {
      user = await prisma.user.create({
        data: {
          login: email,
          password: await bcrypt.hash(temporaryPassword, 10),
          activationCode,
          firstLogin: true,
          type: 3,
          profile: {
            create: {
              name,
              email,
              phone,
              cpf,
              birthDate: birthDate ? new Date(birthDate) : null,
            },
          },
        },
      });

      if (!user) {
        throw new Error("User not created.");
      }

      // LOG: Colaborator created successfully
      console.log("Colaborator created successfully:", user);

      let roleData: {
        roleFeatures: RoleFeature[];
        uid: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        enable: boolean;
        type: number;
        description: string;
      } | null = null;

      roleData = await prisma.role.findUnique({
        where: { uid: process.env.ROLE_COLLABORATOR_UID },
        include: { roleFeatures: true },
      });

      if (!roleData) {
        throw new Error("Role data not found.");
      }

      const parseRoleFeatures = roleData.roleFeatures.map((feature) => {
        return {
          featureUid: feature?.featureUid,
          roleUid: feature?.roleUid,
          actions: feature?.actions as any,
          userUid: user?.uid,
        };
      });

      userFeatures = await prisma.userFeature.createMany({
        data: parseRoleFeatures,
      });

      if (!userFeatures) {
        throw new Error("User features not created.");
      }

      await prisma.collaborator.create({
        data: {
          parentUid: authorization?.data?.masterUid,
          userUid: user?.uid,
        },
      });
    });

    const token = sign(
      {
        uid: user?.uid,
        code: activationCode,
      },
      process.env.JWT_SECRET || "",
      {
        expiresIn: "24h",
      }
    );

    const payload = JSON.stringify({
      name: name,
      source: "contato@alldohost.com.br",
      subject: "Confirmação de E-mail Alldo Assistente",
      ToAddresses: [email],
      link_email: `https://assistente.alldohost.com.br/confirm-account/${token}`,
      temporary_password: temporaryPassword,
      htmlTemplate: "collaborator-confirm-account.html",
    });

    const queueParams: AWS.SQS.SendMessageRequest = {
      MessageBody: payload,
      MessageDeduplicationId: generateRandomString(20),
      QueueUrl: process.env.SEND_EMAIL_QUEUE_URL!,
      MessageGroupId: "SEND_EMAIL",
    };

    try {
      const queueResult = await sqs.sendMessage(queueParams).promise();
      console.log(
        "COLLABORATOR CREATE SUCCESS: Mensagem enviada para SQS de confirmação de e-mail.",
        queueResult
      );
    } catch (error) {
      console.error(
        "COLLABORATOR CREATE ERROR: Erro ao enviar mensagem para SQS de confirmação de e-mail.",
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Erro interno do servidor.",
          error: error.message,
        }),
      };
    }

    console.log(
      "COLLABORATOR CREATE SUCCESS: Colaborador criado com sucesso.",
      user
    );
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Colaborador criado com sucesso.",
        data: user,
      }),
    };
  } catch (error) {
    console.error(
      "COLLABORATOR CREATE ERROR: Falha ao criar colaborador.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar colaborador. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
