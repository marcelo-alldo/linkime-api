import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { RoleFeature, User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as AWS from "aws-sdk";
import { generateRandomString } from "../../utils/generateRandomString";
import * as jwt from "jsonwebtoken";
import { addDays } from "date-fns";

const sqs = new AWS.SQS({ region: "us-east-1" });

export const handler = async (event: APIGatewayEvent) => {
  const { password, name, role, email, phone, cnpj } = JSON.parse(
    event.body || ""
  );
  const database = new Database();

  try {
    if (!name || !email || !phone || !password) {
      console.error("USER CREATE ERROR: Campos obrigatórios não informados.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados.",
        }),
      };
    }

    const alreadyUser = await database.client.dataProfile.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (alreadyUser) {
      -console.error(
        "USER CREATE ERROR: Já existe um usuário cadastrado com e-mail ou telefone informado."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Já existe um usuário cadastrado com e-mail ou telefone informado.",
        }),
      };
    }

    const activationCode = generateRandomString(20);
    let user;
    let userFeatures;

    await database.client.$transaction(async (prisma) => {
      user = await prisma.user.create({
        data: {
          login: email,
          password: await bcrypt.hash(password, 10),
          activationCode: activationCode,
          profile: {
            create: {
              name,
              email,
              phone,
              cnpj,
            },
          },
          configs: {
            create: {
              key: "ALLDO_STATUS",
              value: "CONFIGURATION",
              name: "Status do Alldo Assistente",
              data: JSON.stringify({
                about: false,
                keys: false,
                products: false,
                whatsapp: false,
              }),
            },
          },
          subscriptions: {
            create: {
              status: "TRIAL",
              subscription: {
                connect: {
                  uid: process.env.SUBSCRIPTION_FREE_TRIAL_UID,
                },
              },
              startDate: new Date(),
              endDate: addDays(new Date(), 7),
            },
          },
        },
      });

      if (!user) {
        console.error("USER CREATE ERROR: Usuário não criado.");
        throw new Error("Usuário não criado.");
      }

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
      if (!role) {
        roleData = await prisma.role.findUnique({
          where: { uid: process.env.ROLE_USER_UID },
          include: { roleFeatures: true },
        });
      } else {
        roleData = await prisma.role.findFirst({
          where: { name: role },
          include: { roleFeatures: true },
        });
        if (!roleData) {
          roleData = await prisma.role.findUnique({
            where: { uid: process.env.ROLE_USER_UID },
            include: { roleFeatures: true },
          });
        }
      }
      if (!roleData) {
        console.error(
          "USER CREATE ERROR: Dados de perfil de acesso não encontrados."
        );
        throw new Error("Dados de perfil de acesso não encontrados.");
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
        console.error("USER CREATE ERROR: Permissões do usuário não criadas.");
        throw new Error("Permissões do usuário não criadas.");
      }
    });

    const token = jwt.sign(
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
      subject: "Confirmação de E-mail Alldo Assitente",
      ToAddresses: [email],
      link_email: `https://assistente.alldohost.com.br/confirm-account/${token}`,
      htmlTemplate: "confirm-account.html",
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
        "USER CREATE SUCCESS: Mensagem enviada para fila SEND_EMAIL_QUEUE SQS:",
        queueResult
      );
    } catch (error) {
      console.error(
        "USER CREATE ERROR: Erro ao enviar mensagem para fila SEND_EMAIL_QUEUE SQS:",
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Erro interno ao enviar e-mail de confirmação.",
          error: error.message,
        }),
      };
    }

    console.log("USER CREATE SUCCESS: Cadastro realizado com sucesso.");
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Cadastro realizado com sucesso. Você já pode fazer login.",
      }),
    };
  } catch (error) {
    console.error(
      "USER CREATE ERROR: Ocorreu um erro ao criar sua conta.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Ocorreu um erro ao criar sua conta. Verifique os dados e tente novamente.",
      }),
    };
  } finally {
    await database.client.$disconnect();
  }
};
