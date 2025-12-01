import Database from "../../database";

export const subscription = async (userUid: string) => {
  const database = new Database();

  console.log("SUBSCRIPTION MIDDLEWARE", userUid);

  if (!userUid) {
    console.error("SUBSCRIPTION MIDDLEWARE ERROR: Cabeçalho de usuário ausente.");
    return false;
  }

  try {
    const data = await database.client.userSubscription.findMany({
      where: {
        userUid,
      },
    });

    if (!data || data.length === 0) {
      console.error("SUBSCRIPTION MIDDLEWARE ERROR: Nenhuma assinatura encontrada para o usuário.");
      return false;
    }

    const validSubscription = data.some(
      (subscription) => subscription.status === "ACTIVE" || subscription.status === "TRIAL"
    );

    if (!validSubscription) {
      console.error("SUBSCRIPTION MIDDLEWARE ERROR: Assinatura inválida ou inativa.");
      return false;
    }

    return {
      success: true,
    };
  } catch (error) {
    console.log("SUBSCRIPTION MIDDLEWARE ERROR", error);
    return false;
  } finally {
    await database.disconnect();
  }
};
