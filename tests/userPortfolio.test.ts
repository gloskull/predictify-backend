import request from "supertest";
import { createApp } from "../src/index";
import * as userService from "../src/services/userService";
import { ok, err } from "../src/errors/RouteError";

const VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

const MOCK_PORTFOLIO: userService.UserPortfolio = {
  totalAmountStaked: "10000000",
  activePredictionsCount: 5,
  totalClaimedAmount: "2000000",
};

describe("GET /api/users/:address/portfolio", () => {
  let spy: jest.SpyInstance;

  afterEach(() => {
    spy?.mockRestore();
  });

  it("200 – returns portfolio for a known address", async () => {
    spy = jest.spyOn(userService, "getUserPortfolio").mockResolvedValue(ok(MOCK_PORTFOLIO));

    const res = await request(createApp())
      .get(`/api/users/${VALID_ADDRESS}/portfolio`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(MOCK_PORTFOLIO);
    expect(spy).toHaveBeenCalledWith(VALID_ADDRESS);
  });

  it("404 – returns not_found for unknown user", async () => {
    spy = jest.spyOn(userService, "getUserPortfolio").mockResolvedValue(err({
      kind: "NotFound",
      message: "User not found",
      resource: "User",
    }));

    const res = await request(createApp())
      .get(`/api/users/${VALID_ADDRESS}/portfolio`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("400 – returns validation_error for invalid address", async () => {
    const res = await request(createApp())
      .get("/api/users/INVALID_ADDRESS/portfolio");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("500 – returns internal_error on service failure", async () => {
    spy = jest.spyOn(userService, "getUserPortfolio").mockRejectedValue(new Error("DB Error"));

    const res = await request(createApp())
      .get(`/api/users/${VALID_ADDRESS}/portfolio`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
  });
});
