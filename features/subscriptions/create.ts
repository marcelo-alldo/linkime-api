import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { doPost } from "../../sources/alldo-payments/api";

export const handler = async (event: APIGatewayEvent) => {
  const {
    subscriptionName,
    value,
    dueDate,
    description,
    billingType,
    percentualValue,
    cycle,
    remoteIp,
  } = JSON.parse(event.body || "");

  const authorization = (await auth(event)) as { success: boolean; data: any };
  const xForwardedFor = remoteIp;

  const database = new Database();

  console.log("X-FORWARDED-FOR", xForwardedFor);

  let response;

  try {
    if (!authorization) {
      console.error(
        "CREATE SUBSCRIPTION ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (
      !value ||
      !dueDate ||
      !description ||
      !billingType ||
      !cycle ||
      !remoteIp
    ) {
      console.error(
        "CREATE SUBSCRIPTION ERROR: Campos obrigatórios não informados."
      );
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados.",
        }),
      };
    }

    const creditCardToken = await database.client.userCreditCard.findFirst({
      where: {
        userUid: authorization?.data?.masterUid,
      },
    });

    const user = await database.client.dataProfile.findFirst({
      where: {
        user: {
          uid: authorization?.data?.masterUid,
        },
      },
      select: {
        uid: true,
        name: true,
        cpf: true,
        cnpj: true,
        email: true,
      },
    });

    if (!user) {
      console.error("CREATE SUBSCRIPTION ERROR: Usuário não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    const subscription = await database.client.subscription.findFirst({
      where: {
        name: subscriptionName,
      },
    });

    if (!subscription) {
      console.error(
        "CREATE SUBSCRIPTION ERROR: Plano de assinatura não encontrado."
      );
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Plano de assinatura não encontrado.",
        }),
      };
    }

    try {
      const data = {
        name: user.name,
        cpfCnpj: user.cpf || user.cnpj,
        email: user.email,
        value,
        dueDate,
        description,
        billingType,
        userUid: user.uid,
        percentualValue,
        cycle,
        creditCardToken,
        remoteIp,
      };

      console.log(data, "DATA ----------------------------");

      const lastActiveSubscription = await database.client.userSubscription.findFirst({
        where: {
          userUid: authorization.data.masterUid,
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (lastActiveSubscription) {
        await database.client.userSubscription.update({
          where: {
            uid: lastActiveSubscription.uid,
          },
          data: {
            status: "CANCELED",
          },
        });
        console.log("Última assinatura cancelada:", lastActiveSubscription.uid);
      }

      const subscriptionType = cycle === "YEARLY" ? "YEARLY" : "MONTHLY";
      const startDate = new Date();
      const endDate = new Date();

      if (subscriptionType === "YEARLY") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const userSubscription = await database.client.userSubscription.create({
        data: {
          userUid: authorization.data.masterUid,
          subscriptionUid: subscription.uid,
          type: subscriptionType,
          status: "ACTIVE",
          startDate,
          endDate,
        },
      });

      console.log("Assinatura criada no banco:", userSubscription);

      // Chamar API externa (descomentado para funcionar)
      response = await doPost("/subscriptions/create", data);

      console.log("CREATE SUBSCRIPTION RESPONSE", response);

      if (response.success !== true) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg:
              response?.data?.errors[0]?.description ||
              "Erro ao cadastrar a assinatura.",
          }),
        };
      }
    } catch (error) {
      console.log("CREATE SUBSCRIPTION ERROR", error);
      console.log("CREATE SUBSCRIPTION RESPONSE ERROR", response);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg:
            response?.data?.errors[0]?.description ||
            "Erro ao cadastrar a assinatura.",
        }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Assinatura cadastrada com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "CREATE SUBSCRIPTION ERROR: Erro interno do servidor.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno do servidor.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
