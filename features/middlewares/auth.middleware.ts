import { APIGatewayEvent } from "aws-lambda";
import * as jwt from "jsonwebtoken";

export const auth = async (event: APIGatewayEvent) => {
  const { authorization } = event.headers;

  console.log("AUTH MIDDLEWARE", authorization);

  if (!authorization) {
    return false;
  }

  const token = authorization.split(" ")[1];

  if (!token) {
    console.log("AUTH MIDDLEWARE NOT TOKEN", token);
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as jwt.JwtPayload;

    console.log("AUTH MIDDLEWARE DECODED", decoded);

    const data = {};

    if (decoded?.role === "collaborator") {
      data["masterUid"] = decoded.parentUid;
    } else {
      data["masterUid"] = decoded.uid;
    }

    data["userUid"] = decoded.uid;
    data["role"] = decoded.role;
    data["subscription"] = decoded.subscription || null;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.log("AUTH MIDDLEWARE ERROR", error);
    return false;
  }
};
