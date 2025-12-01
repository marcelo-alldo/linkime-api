import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";
import { formatPhoneToDb } from "../../utils/formatPhone";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { email, name, phone, stepUid } = JSON.parse(event.body || "");
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  // LOG: Received parameters
  console.log("Received parameters:", { email, name, phone });

  try {
    if (!authorization) {
      console.error(
        "LEAD CREATE ERROR: Cabeçalho de autorização ausente ou inválido."
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
      console.error("LEAD CREATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!name || !phone) {
      console.error(
        "LEAD CREATE ERROR: Campos obrigatórios não informados (nome, telefone)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (nome, telefone).",
        }),
      };
    }

    //Verifica se já existe um lead ou cliente com o mesmo telefone
    const parsedPhone = formatPhoneToDb(phone);

    console.log("Parsed phone:", parsedPhone);

    const existingLead = await database.client.lead.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        phone: parsedPhone,
      },
      select: {
        uid: true,
        name: true,
        phone: true,
        email: true,
        iaConversation: true,
      },
    });
    if (existingLead) {
      console.error(
        "LEAD CREATE ERROR: Já existe um lead com o mesmo telefone.",
        {
          leadName: existingLead.name,
          phone: parsedPhone,
          iaConversation: existingLead.iaConversation,
        }
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          data: { ...existingLead, type: "lead" },
          iaConversation: existingLead.iaConversation,
          msg: "Já existe um lead ou cliente com o mesmo telefone.",
        }),
      };
    }

    const existClient = await database.client.client.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        clientProfile: {
          phone: parsedPhone,
        },
      },
      select: {
        uid: true,
        iaConversation: true,
        clientProfile: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    if (existClient) {
      console.error(
        "LEAD CREATE ERROR: Já existe um cliente com o mesmo telefone.",
        {
          clientName: existClient.clientProfile.name,
          phone: parsedPhone,
          iaConversation: existClient.iaConversation,
        }
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          data: {
            uid: existClient.uid,
            name: existClient.clientProfile.name,
            phone: existClient.clientProfile.phone,
            email: existClient.clientProfile.email,
            iaConversation: existClient.iaConversation,
            type: "client",
          },
          msg: "Já existe um cliente com o mesmo telefone.",
        }),
      };
    }

    const stepSelectedUid = stepUid || process.env.FIRST_STEP_UID;

    const lastLead = await database.client.lead.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        stepUid: stepSelectedUid,
      },
      orderBy: {
        position: "desc",
      },
      select: {
        position: true,
      },
    });

    // Buscar assinatura ativa do usuário
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

    const [totalLeads, totalClients] = await Promise.all([
      database.client.lead.count({
        where: {
          userUid: authorization.data.masterUid,
        },
      }),
      database.client.client.count({
        where: {
          userUid: authorization.data.masterUid,
        },
      }),
    ]);

    const totalContacts = totalLeads + totalClients;

    let leadLimit = 1;

    if (userSubscription) {
      if (
        userSubscription.status === "TRIAL" ||
        userSubscription.subscription.uid ===
          process.env.SUBSCRIPTION_FREE_TRIAL_UID
      ) {
        leadLimit = 1;
      } else if (
        userSubscription.subscription.uid ===
        process.env.SUBSCRIPTION_DEFAULT_UID
      ) {
        leadLimit = 1000;
      } else if (
        userSubscription.subscription.uid ===
        process.env.SUBSCRIPTION_CUSTOM_UID
      ) {
        leadLimit = 5000;
      } else if (
        userSubscription.subscription.uid ===
        process.env.SUBSCRIPTION_SERVICE_UID
      ) {
        leadLimit = 500;
      }
    }

    if (totalContacts >= leadLimit) {
      const isTrialPlan =
        userSubscription?.status === "TRIAL" ||
        userSubscription?.subscription.uid ===
          process.env.SUBSCRIPTION_FREE_TRIAL_UID;

      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: isTrialPlan
            ? "Sua assinatura é apenas para teste, você pode testar com um contato apenas."
            : `Sua assinatura permite apenas ${leadLimit} contatos (leads e clientes). ${
                leadLimit < 5000
                  ? "Você pode alterar quando quiser."
                  : "Caso precise alterar contate o especialista."
              }`,
        }),
      };
    }

    const lastPosition = lastLead?.position;

    // LOG: Last lead found
    console.log(
      "Last lead:",
      lastPosition,
      "Total leads:",
      totalLeads,
      "Total clients:",
      totalClients,
      "Total contacts:",
      totalContacts,
      "Lead limit:",
      leadLimit
    );

    const nextPosition = lastPosition ? lastPosition + 1 : 1;

    // LOG: Next position to use
    console.log("Next position:", nextPosition);

    const newLead = await database.client.lead.create({
      data: {
        email,
        name,
        phone: parsedPhone,
        position: nextPosition,
        user: {
          connect: { uid: authorization.data.userUid },
        },
        step: {
          connect: {
            uid: stepSelectedUid,
          },
        },
      },
    });

    // LOG: Lead created successfully
    console.log(
      "LEAD CREATE SUCCESS: Lead criado com sucesso para o usuário:",
      authorization.data.uid
    );
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        data: { ...newLead, type: "lead" },
        msg: "Lead criado com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("LEAD CREATE ERROR: Falha ao criar lead.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar lead. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
