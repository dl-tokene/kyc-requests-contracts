export async function getConfigJson() {
  const vault = require("node-vault")({
    apiVersion: "v1",
    endpoint: process.env.VAULT_ENDPOINT,
    token: process.env.VAULT_TOKEN,
  });

  const responseBody = (await vault.read(process.env.VAULT_FETCH_CONFIG_PATH)).data;

  if (!responseBody.data.addresses || !responseBody.data.addresses.MasterContractsRegistry) {
    console.error(`MasterContractsRegistry address is not set in the config`);

    process.exit(1);
  }

  return responseBody.data;
}
