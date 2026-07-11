/**
 * Known ANP implementations. To get listed, open a pull request against
 * this file; see the Get listed section on /implementations.
 */

export interface Implementation {
  name: string;
  role: "buyer host" | "vendor agent";
  status: "conforming" | "in progress";
  homepage: string;
}

export const IMPLEMENTATIONS: Implementation[] = [
  {
    name: "VendorBenchmark",
    role: "buyer host",
    status: "conforming",
    homepage: "https://app.vendorbenchmark.com/agent-protocol/vendors",
  },
];
