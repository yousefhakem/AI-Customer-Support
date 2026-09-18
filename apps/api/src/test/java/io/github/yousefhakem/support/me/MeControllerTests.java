package io.github.yousefhakem.support.me;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import io.github.yousefhakem.support.testsupport.IntegrationTest;
import io.github.yousefhakem.support.testsupport.TestJwts;

class MeControllerTests extends IntegrationTest {

	@Test
	void validTokenReturnsOrgIdAndUserId() throws Exception {
		getMe(TestJwts.valid("org_123"))
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.orgId").value("org_123"))
			.andExpect(jsonPath("$.userId").value("user_test"));
	}

	@Test
	void missingTokenIsRejectedAsIdentityNotFound() throws Exception {
		expectIdentityNotFound(mockMvc.perform(get("/api/private/me")));
	}

	@Test
	void malformedTokenIsRejectedAsIdentityNotFound() throws Exception {
		expectIdentityNotFound(getMe("not-a-jwt"));
	}

	@Test
	void tokenWithBadSignatureIsRejectedAsIdentityNotFound() throws Exception {
		expectIdentityNotFound(getMe(TestJwts.signedWithWrongKey("org_123")));
	}

	@Test
	void expiredTokenIsRejectedAsIdentityNotFound() throws Exception {
		expectIdentityNotFound(getMe(TestJwts.expired("org_123")));
	}

	@Test
	void tokenFromWrongIssuerIsRejectedAsIdentityNotFound() throws Exception {
		expectIdentityNotFound(getMe(TestJwts.withIssuer("https://evil.example", "org_123")));
	}

	@Test
	void tokenForWrongAudienceIsRejectedAsIdentityNotFound() throws Exception {
		expectIdentityNotFound(getMe(TestJwts.withAudience("other-api", "org_123")));
	}

	@Test
	void tokenWithoutOrgIdIsRejectedAsOrganizationNotFound() throws Exception {
		getMe(TestJwts.withoutOrgId())
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.detail").value("Organization not found"));
	}

	@Test
	void tokenWithBlankOrgIdIsRejectedAsOrganizationNotFound() throws Exception {
		getMe(TestJwts.valid(" "))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.detail").value("Organization not found"));
	}

	private ResultActions getMe(String token) throws Exception {
		return mockMvc.perform(get("/api/private/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private static void expectIdentityNotFound(ResultActions result) throws Exception {
		result.andExpect(status().isUnauthorized())
			.andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, startsWith("Bearer")))
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(401))
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.detail").value("Identity not found"));
	}

}
