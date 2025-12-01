import Database from "../../../database";

export const handler = async () => {
  const database = new Database();

  try {
    // Busca assinaturas vencidas que ainda não estão marcadas como EXPIRED
    const expiredSubscriptions = await database.client.userSubscription.findMany({
      where: {
        endDate: {
          lt: new Date(),
        },
        status: {
          in: ["ACTIVE", "TRIAL"],
        },
      },
    });

    if (expiredSubscriptions.length === 0) {
      console.log("Nenhuma assinatura expirada encontrada para atualizar.");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Nenhuma assinatura expirada encontrada para atualizar.",
        }),
      };
    }

    for (const subscription of expiredSubscriptions) {
      await database.client.userSubscription.update({
        where: {
          uid: subscription.uid,
        },
        data: {
          status: "EXPIRED",
        },
      });
    }

    console.log(`Assinaturas expiradas atualizadas: ${expiredSubscriptions.length}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: `Assinaturas expiradas atualizadas: ${expiredSubscriptions.length}`,
      }),
    };
  } catch (error) {
    console.error("USER VERIFY SUBSCRIPTIONS: Falha ao verificar as assinaturas expiradas.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao verificar as assinaturas expiradas.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
