import { APIGatewayEvent } from "aws-lambda";
import * as jwt from "jsonwebtoken";
import Database from "../../database";
import * as bcrypt from "bcryptjs";

export const handler = async (event: APIGatewayEvent) => {
  const { login, password } = JSON.parse(event.body || "");
  const database = new Database();

  if (!login || !password) {
    console.error("AUTH LOGIN ERROR: Login ou senha não informados.");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "Login ou senha não informados.",
      }),
    };
  }

  try {
    const user = await database.client.user.findUnique({
      where: { login },
      include: {
        profile: true,
        parent: true,
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

    console.log("AUTH LOGIN: Tentativa de login para usuário:", user);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.error("AUTH LOGIN ERROR: Usuário ou senha incorretos.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Usuário ou senha incorretos.",
        }),
      };
    }

    if (user?.activationCode && !user?.confirmed) {
      console.error("AUTH LOGIN ERROR: Seu e-mail ainda não foi confirmado, verifique sua caixa de entrada ou spam.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Seu e-mail ainda não foi confirmado, verifique sua caixa de entrada ou spam.",
        }),
      };
    }

    if (!user?.enable) {
      console.error("AUTH LOGIN ERROR: Sua conta está desativada.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Sua conta está desativada, por favor entre em contato com o nosso suporte para mais detalhes.",
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

    console.log("AUTH LOGIN SUCCESS: Login realizado com sucesso.", userData);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          user: userData,
          access_token: jwt.sign(
            {
              uid: user?.uid,
              role: user?.userFeatures?.[0]?.role?.name || "user",
              parentUid: user?.collaborators?.[0]?.parentUid,
              subscription: user?.subscriptions?.[0]?.subscriptionUid || null,
            },
            process.env.JWT_SECRET || "",
            {
              expiresIn: process.env.JWT_EXPIRES_IN,
            }
          ),
        },
        msg: "Login realizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("AUTH LOGIN ERROR: Erro interno no servidor.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno no servidor.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
