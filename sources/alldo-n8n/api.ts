const baseUrl = process.env.ALLDO_N8N_API_URL;
const apiKey = process.env.ALLDO_N8N_ACCESS_TOKEN;

async function doGet(url: string) {
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-N8N-API-KEY": apiKey ? apiKey : "",
      },
    });

    console.log("RESPONSE DO GET API N8N:", response);

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("ALLDO N8N API ERROR: ", error);
  }
}

async function doPost(url: string, body: any) {
  console.log("BODY DO POST:", body ? JSON.stringify(body) : "undefined");
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-N8N-API-KEY": apiKey ? apiKey : "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    console.log("RESPONSE DO POST DATA API N8N:", data);
    return data;
  } catch (error) {
    console.error("ALLDO N8N API ERROR: ", error);
  }
}

async function doRest(url: string) {
  // const url = "/rest/oauth2-credential/auth?id=ekZMv2T8splOZug1";
  const login = await fetch(`${baseUrl}/rest/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      emailOrLdapLoginId: process.env.ALLDO_N8N_USER || "",
      password: process.env.ALLDO_N8N_PASSWORD || "",
    }),
    credentials: "include",
  });

  const cookies = login.headers.get("set-cookie");

  const headers = {
    Cookie: cookies ?? "",
  };

  const response = await fetch(`${baseUrl}${url}`, { method: "GET", headers });
  const data = await response.json();

  return data;
}

export { doGet, doPost, doRest };
