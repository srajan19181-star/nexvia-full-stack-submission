const json = { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } };
const secured = [{ cookieAuth: [] }];

export const openapiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AUREVA Marketplace API",
    version: "1.0.0",
    description: "REST API for the AUREVA customer, vendor, and administrator applications. Mutating cookie-authenticated requests require the CSRF token cookie value in the x-csrf-token header.",
  },
  servers: [{ url: "/api/v1", description: "Current deployment" }],
  tags: [
    { name: "Authentication" }, { name: "Catalog" }, { name: "Customer" }, { name: "Orders" },
    { name: "Vendor" }, { name: "Administration" }, { name: "Webhooks" },
  ],
  paths: {
    "/auth/register": { post: { tags: ["Authentication"], summary: "Register a pending-verification customer", requestBody: { required: true, content: json }, responses: { "201": { description: "Verification email issued", content: json }, "409": { $ref: "#/components/responses/Error" } } } },
    "/auth/login": { post: { tags: ["Authentication"], summary: "Create rotating cookie session", requestBody: { required: true, content: json }, responses: { "200": { description: "Authenticated", headers: { "Set-Cookie": { schema: { type: "string" } } }, content: json }, "401": { $ref: "#/components/responses/Error" } } } },
    "/auth/refresh": { post: { tags: ["Authentication"], summary: "Rotate refresh token", responses: { "200": { description: "Session rotated", content: json }, "401": { $ref: "#/components/responses/Error" } } } },
    "/auth/logout": { post: { tags: ["Authentication"], summary: "Revoke current session", responses: { "200": { description: "Logged out", content: json } } } },
    "/auth/verify-email": { post: { tags: ["Authentication"], summary: "Consume email verification token", requestBody: { required: true, content: json }, responses: { "200": { description: "Verified", content: json }, "400": { $ref: "#/components/responses/Error" } } } },
    "/auth/forgot-password": { post: { tags: ["Authentication"], summary: "Request password reset", requestBody: { required: true, content: json }, responses: { "200": { description: "Generic acknowledgement", content: json } } } },
    "/products": { get: { tags: ["Catalog"], summary: "List and facet active products", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "category", in: "query", schema: { type: "string" } }, { name: "vendor", in: "query", schema: { type: "string" } }, { name: "brand", in: "query", schema: { type: "string" } }, { name: "page", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } }], responses: { "200": { description: "Paginated product list", content: json } } } },
    "/products/{slug}": { get: { tags: ["Catalog"], summary: "Get active product detail", parameters: [{ $ref: "#/components/parameters/Slug" }], responses: { "200": { description: "Product detail", content: json }, "404": { $ref: "#/components/responses/Error" } } } },
    "/search": { get: { tags: ["Catalog"], summary: "Full-text product search with PostgreSQL fallback", parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } }], responses: { "200": { description: "Search results and source", content: json } } } },
    "/cart": { get: { tags: ["Customer"], security: secured, summary: "Get persistent active cart", responses: { "200": { description: "Cart", content: json }, "401": { $ref: "#/components/responses/Error" } } } },
    "/cart/items": { put: { tags: ["Customer"], security: secured, summary: "Upsert a validated cart line", requestBody: { required: true, content: json }, responses: { "200": { description: "Updated cart", content: json }, "409": { $ref: "#/components/responses/Error" } } } },
    "/checkout": { post: { tags: ["Orders"], security: secured, summary: "Reserve inventory, create parent/vendor orders, and initiate payment", parameters: [{ name: "idempotency-key", in: "header", required: true, schema: { type: "string", minLength: 8 } }], requestBody: { required: true, content: json }, responses: { "200": { description: "Existing idempotent checkout", content: json }, "201": { description: "Order and payment intent created", content: json }, "409": { $ref: "#/components/responses/Error" } } } },
    "/orders": { get: { tags: ["Orders"], security: secured, summary: "List the authenticated customer's orders", responses: { "200": { description: "Orders", content: json } } } },
    "/orders/{id}": { get: { tags: ["Orders"], security: secured, summary: "Get owned order, shipments, returns, and payment state", parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: "Order detail", content: json }, "404": { $ref: "#/components/responses/Error" } } } },
    "/orders/{id}/returns": { post: { tags: ["Orders"], security: secured, summary: "Request a return for eligible delivered lines", parameters: [{ $ref: "#/components/parameters/Id" }], requestBody: { required: true, content: json }, responses: { "201": { description: "Return requested", content: json }, "422": { $ref: "#/components/responses/Error" } } } },
    "/vendors/apply": { post: { tags: ["Vendor"], security: secured, summary: "Submit vendor application", requestBody: { required: true, content: json }, responses: { "201": { description: "Application created", content: json } } } },
    "/vendors/products": { get: { tags: ["Vendor"], security: secured, summary: "List owned products", responses: { "200": { description: "Products", content: json } } }, post: { tags: ["Vendor"], security: secured, summary: "Create owned product pending moderation", requestBody: { required: true, content: json }, responses: { "201": { description: "Product submitted", content: json }, "403": { $ref: "#/components/responses/Error" } } } },
    "/vendors/orders/{id}/status": { post: { tags: ["Vendor"], security: secured, summary: "Apply an allowed fulfillment transition to an owned vendor order", parameters: [{ $ref: "#/components/parameters/Id" }], requestBody: { required: true, content: json }, responses: { "200": { description: "Status updated", content: json }, "409": { $ref: "#/components/responses/Error" } } } },
    "/admin/vendors/{id}/decision": { post: { tags: ["Administration"], security: secured, summary: "Approve, reject, suspend, or restore vendor", parameters: [{ $ref: "#/components/parameters/Id" }], requestBody: { required: true, content: json }, responses: { "200": { description: "Vendor updated", content: json }, "403": { $ref: "#/components/responses/Error" } } } },
    "/admin/products/{id}/moderate": { post: { tags: ["Administration"], security: secured, summary: "Moderate a product and enqueue search indexing", parameters: [{ $ref: "#/components/parameters/Id" }], requestBody: { required: true, content: json }, responses: { "200": { description: "Product moderated", content: json } } } },
    "/admin/returns/{id}/refund": { post: { tags: ["Administration"], security: secured, summary: "Issue provider-backed refund and reverse commission", parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: "Refund initiated", content: json }, "409": { $ref: "#/components/responses/Error" } } } },
    "/webhooks/stripe": { post: { tags: ["Webhooks"], summary: "Receive signed Stripe events with duplicate protection", parameters: [{ name: "stripe-signature", in: "header", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } }, responses: { "200": { description: "Event accepted", content: json }, "400": { $ref: "#/components/responses/Error" } } } },
  },
  components: {
    securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "aureva_access", description: "Short-lived signed JWT stored in a Secure HttpOnly cookie." } },
    parameters: {
      Id: { name: "id", in: "path", required: true, schema: { type: "string" } },
      Slug: { name: "slug", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" } },
    },
    schemas: {
      Envelope: { type: "object", required: ["success"], properties: { success: { type: "boolean" }, data: {}, meta: { type: "object", additionalProperties: true }, error: { $ref: "#/components/schemas/ApiError" } } },
      ApiError: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} }, required: ["code", "message"] },
    },
    responses: {
      Error: {
        description: "Structured API error",
        content: {
          "application/json": {
            schema: { type: "object", properties: { success: { const: false }, error: { $ref: "#/components/schemas/ApiError" } } },
          },
        },
      },
    },
  },
} as const;
