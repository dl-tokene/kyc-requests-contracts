import { Deployer } from "@solarity/hardhat-migrate";

import assert from "assert";

import { KYCRequests__factory, MasterContractsRegistry__factory } from "@ethers-v6";

import { getConfigJson } from "./config/config-parser";

import { KYC_REQUESTS_DEP } from "./utils/constants";

export = async (deployer: Deployer) => {
  const config = await getConfigJson();

  const registry = await deployer.deployed(MasterContractsRegistry__factory, config.addresses.MasterContractsRegistry);
  const kycRequests = await deployer.deployed(KYCRequests__factory, await registry.getContract(KYC_REQUESTS_DEP));

  const kycRole = config.role;

  assert(kycRole, "Invalid KYC role");

  await kycRequests.__KYCRequests_init(kycRole);
  await registry.injectDependencies(KYC_REQUESTS_DEP);
};
