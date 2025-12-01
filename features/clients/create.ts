import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { Address } from "@prisma/client";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  // Parse all possible fields from body
  const {
    email,
    name,
    phone,
    cpf,
    summary,
    notes,
    birthDate,
    cnpj,
    fantasyName,
    address,
    complement,
    cityUid,
    latitude,
    longitude,
    neighborhood,
    number,
    zipCode,
    deleteLead,
  } = JSON.parse(event.body || "{}");
  // LOG: Received parameters
  console.log("Received parameters:", {
    email,
    name,
    phone,
    cpf,
    summary,
    notes,
    birthDate,
    cnpj,
    fantasyName,
    address,
    complement,
    cityUid,
    latitude,
    longitude,
    neighborhood,
    number,
    zipCode,
    deleteLead,
  });

  // LOG: Authenticated user UID
  console.log("Authenticated user UID:", authorization.data.userUid);

  try {
    if (!authorization) {
      console.error(
        "CLIENT CREATE ERROR: Cabeçalho de autorização ausente ou inválido."
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
      console.error("CLIENT CREATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    // Only name and phone are required
    if (!name || !phone) {
      console.error(
        "CLIENT CREATE ERROR: Campos obrigatórios não informados (nome, telefone)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (nome, telefone).",
        }),
      };
    }

    // Check if a client with the same phone number already exists for this user
    const existingClient = await database.client.client.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        clientProfile: {
          phone: phone,
        },
      },
      select: {
        uid: true,
        iaConversation: true,
        clientProfile: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    if (existingClient) {
      console.error(
        "CLIENT CREATE ERROR: Cliente com este número de telefone já existe.",
        {
          existingClientName: existingClient.clientProfile.name,
          phone: phone,
          iaConversation: existingClient.iaConversation,
        }
      );
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          msg: `Já existe um cliente cadastrado com este número de telefone (${phone}). Cliente: ${existingClient.clientProfile.name}`,
          iaConversation: existingClient.iaConversation, // Retornar a flag
        }),
      };
    }

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

    const lastClient = await database.client.client.findFirst({
      where: {
        userUid: authorization.data.masterUid,
        stepUid: process.env.FIRST_STEP_CLIENT_UID,
      },
      orderBy: {
        position: "desc",
      },
      select: {
        position: true,
      },
    });

    const lastPosition = lastClient?.position;

        const nextPosition = lastPosition ? lastPosition + 1 : 1;

    // Contar total de leads + clientes para validação de limite
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

    // Validação de limite baseada na assinatura
    let leadLimit = 1; // Padrão conservador

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

    // LOG: Creating new client
    console.log("Creating new client with data:", {
      email,
      name,
      phone,
      cpf,
      summary,
      notes,
      birthDate,
      cnpj,
      fantasyName,
      address,
      complement,
      cityUid,
      latitude,
      longitude,
      neighborhood,
      number,
      zipCode,
      deleteLead,
    });

    // LOG: Subscription validation
    console.log(
      "Total leads:",
      totalLeads,
      "Total clients:",
      totalClients,
      "Total contacts:",
      totalContacts,
      "Lead limit:",
      leadLimit
    );

    const result = await database.client.$transaction(async (prisma) => {
      // Cria o perfil
      const createdProfile = await prisma.dataClient.create({
        data: {
          email,
          name,
          phone,
          cpf,
          birthDate: birthDate ? new Date(birthDate) : null,
          cnpj,
          summary,
          notes,
          fantasyName,
        },
      });

      // Cria o endereço se zipCode informado
      let createdAddress: Address | undefined = undefined;
      if (zipCode) {
        createdAddress = await prisma.address.create({
          data: {
            address,
            complement,
            city: { connect: { uid: cityUid } },
            latitude,
            longitude,
            neighborhood,
            number,
            point: `POINT(${longitude} ${latitude})`,
            zipCode,
          },
        });
      }

      console.log('process.env.FIRST_STEP_CLIENT_UID', process.env.FIRST_STEP_CLIENT_UID)

      // Cria o cliente
      const createdClient = await prisma.client.create({
        data: {
          user: { connect: { uid: authorization.data.masterUid } },
          clientProfile: { connect: { uid: createdProfile.uid } },
          address: createdAddress
            ? { connect: { uid: createdAddress.uid } }
            : undefined,
          step: {
            connect: {
              uid: process.env.FIRST_STEP_CLIENT_UID,
            },
          },
          position: nextPosition,
        },
      });

      if (deleteLead) {
        const deleteLead = await prisma.lead.deleteMany({
          where: { userUid: authorization.data.masterUid, phone: phone },
        });

        console.log(
          "CLIENT CREATE LOG: Lead deleted successfully.",
          deleteLead
        );
      }

      return { createdClient, createdProfile, createdAddress };
    });

    // LOG: Client created successfully
    console.log("CLIENT CREATE SUCCESS: Cliente criado com sucesso.", result);
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Cliente criado com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("CLIENT CREATE ERROR: Falha ao criar cliente.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar cliente. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};