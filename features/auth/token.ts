import { APIGatewayEvent } from "aws-lambda";
import * as jwt from "jsonwebtoken";
import Database from "../../database";

export const handler = async (event: APIGatewayEvent) => {
  const { authorization } = event.headers;
  const database = new Database();

  console.log("LOG USER EVENT", event);

  if (!authorization) {
    console.error("AUTH TOKEN ERROR: Cabeçalho de autorização ausente.");
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        msg: "Cabeçalho de autorização ausente.",
      }),
    };
  }

  let token: string = authorization.split(" ")[1];
  let decodedToken: any;

  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET || "");
  } catch (error) {
    console.error("AUTH TOKEN ERROR: Token inválido.", error);
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        msg: "Token inválido.",
      }),
    };
  }

  const idUser = decodedToken?.uid;

  try {
    const user = await database.client.user.findUnique({
      where: { uid: idUser },
      include: {
        profile: true,
        collaborators: {
          include: {
            parent: true,
          },
        },
        userFeatures: { include: { role: true, feature: true } },
        subscriptions: {
          include: { subscription: true },
          where: { status: { not: "CANCELED" } },
        },
      },
    });

    if (!user) {
      console.error("AUTH TOKEN ERROR: Token inválido. Usuário não encontrado.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Token inválido.",
        }),
      };
    }

    const userData = {
      uid: user?.uid,
      role: user?.userFeatures?.[0]?.role?.name || "user",
      data: {
        displayName: user.profile?.name || "sem nome",
        photoURL: "",
        email: user?.profile?.email || "sem email",
        masterEmail: user?.collaborators?.[0]?.parent?.login || user?.profile?.email,
        confirmed: user?.confirmed,
        firstLogin: user?.firstLogin,
        tokenFirebase: user?.tokenFirebase,
        loginRedirectUrl: user?.userFeatures?.[0]?.feature?.endpoint,
        subscription: user?.subscriptions?.[0]?.subscriptionUid || null,
        settings: {
          layout: {},
          theme: {},
        },
        shortcuts: [],
      },
    };
    console.log("AUTH TOKEN SUCCESS: Usuário logado com sucesso.", userData);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: { user: userData },
        msg: "Usuário logado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("AUTH USER ERROR: Erro interno do servidor.", error);
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
