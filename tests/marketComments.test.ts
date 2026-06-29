import request from "supertest";
import jwt from "jsonwebtoken";

const TEST_SECRET = "a-very-long-test-secret-at-least-32-bytes!!";
const TEST_ISSUER = "predictify";
const TEST_AUDIENCE = "predictify-app";
const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";
const TEST_STELLAR = "GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = TEST_SECRET;
process.env.JWT_ISSUER = TEST_ISSUER;
process.env.JWT_AUDIENCE = TEST_AUDIENCE;
process.env.DATABASE_URL = "postgres://localhost/test";
process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
process.env.HORIZON_URL = "https://horizon-testnet.stellar.org";
process.env.PREDICTIFY_CONTRACT_ID = "CABCDEF";

// Mock pg
jest.mock("pg", () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

const mockLimit = jest.fn();
const mockWhere = jest.fn(() => ({ limit: mockLimit }));
const mockFrom = jest.fn(() => ({ where: mockWhere }));
const mockSelect = jest.fn(() => ({ from: mockFrom }));

jest.mock("drizzle-orm/node-postgres", () => ({
  drizzle: jest.fn(() => ({ select: mockSelect })),
}));

import { createApp } from "../src/index";
import { setDbForTests } from "../src/db/client";

function signToken() {
  return jwt.sign({ sub: TEST_STELLAR }, TEST_SECRET, {
    algorithm: "HS256",
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    expiresIn: 3600,
  });
}

describe("POST /api/markets/:id/comments", () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
    setDbForTests(null);
  });

  it("should return 401 if unauthenticated", async () => {
    const res = await request(app)
      .post("/api/markets/market-1/comments")
      .send({ content: "test comment" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("should return 404 if market does not exist", async () => {
    mockLimit.mockResolvedValue([{ id: TEST_USER_ID, stellarAddress: TEST_STELLAR }]);

    const selectMock = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValueOnce([])
          }))
        }))
      }));

    setDbForTests({ select: selectMock } as any);

    const token = signToken();
    const res = await request(app)
      .post("/api/markets/non-existent/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "test comment" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("should return 400 for invalid content", async () => {
    mockLimit.mockResolvedValue([{ id: TEST_USER_ID, stellarAddress: TEST_STELLAR }]);

    const selectMock = jest.fn();
    setDbForTests({ select: selectMock } as any);

    const token = signToken();
    const res = await request(app)
      .post("/api/markets/market-1/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("should create a comment successfully", async () => {
    mockLimit.mockResolvedValue([{ id: TEST_USER_ID, stellarAddress: TEST_STELLAR }]);

    const selectMock = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValueOnce([{ id: "market-1", status: "active" }])
          }))
        }))
      }));

    const returningMock = jest.fn().mockResolvedValueOnce([{
        id: "comment-1",
        marketId: "market-1",
        userId: TEST_USER_ID,
        content: "test comment",
        createdAt: new Date().toISOString()
      }]);
    const valuesMock = jest.fn(() => ({
        returning: returningMock
      }));
    const insertMock = jest.fn(() => ({
      values: valuesMock
    }));

    setDbForTests({ select: selectMock, insert: insertMock } as any);

    const token = signToken();
    const res = await request(app)
      .post("/api/markets/market-1/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "test comment" });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("test comment");
    expect(res.body.data.marketId).toBe("market-1");
    expect(res.body.data.userId).toBe(TEST_USER_ID);
  });

  it("should enforce rate limits", async () => {
    mockLimit.mockResolvedValue([{ id: TEST_USER_ID, stellarAddress: TEST_STELLAR }]);

    const selectMock = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([{ id: "market-1", status: "active" }])
          }))
        }))
      }));

    const insertMock = jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([{
          id: "comment-1",
          marketId: "market-1",
          userId: TEST_USER_ID,
          content: "test comment",
          createdAt: new Date().toISOString()
        }])
      }))
    }));

    setDbForTests({ select: selectMock, insert: insertMock } as any);

    const token = signToken();

    // We used 3 slots in previous tests in THIS suite instance.
    // 4th
    let res = await request(app)
        .post("/api/markets/market-1/comments")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "comment 4" });
    expect(res.status).toBe(201);

    // 5th
    res = await request(app)
        .post("/api/markets/market-1/comments")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "comment 5" });
    expect(res.status).toBe(201);

    // 6th - blocked
    res = await request(app)
        .post("/api/markets/market-1/comments")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "blocked comment" });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("rate_limit_exceeded");
  });
});
