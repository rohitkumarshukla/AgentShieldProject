/**
 * Standard API response envelope utility for AgentShield.
 *
 * Ensures consistent response formatting across all HTTP endpoints.
 * A governance decision of BLOCK or APPROVAL_REQUIRED is still a successfully
 * processed API request, so its HTTP status can be 200 while data.decision
 * reflects the governance outcome.
 */
export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code (e.g., 200, 201, 400, 500).
   * @param {any} [data=null] - The payload to return in the response.
   * @param {string} [message="Success"] - Human-readable response summary.
   */
  constructor(statusCode, data = null, message = "Success") {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;
    this.message = message;
    this.data = data;
  }
}
