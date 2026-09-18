package io.github.yousefhakem.support.common.auth;

import static org.hamcrest.Matchers.containsStringIgnoringCase;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import io.github.yousefhakem.support.testsupport.IntegrationTest;

class CorsTests extends IntegrationTest {

	@Test
	void preflightFromAllowedOriginSucceedsWithoutToken() throws Exception {
		mockMvc.perform(options("/api/private/me").header(HttpHeaders.ORIGIN, "http://localhost:3000")
			.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
			.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization"))
			.andExpect(status().isOk())
			.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000"))
			.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
					containsStringIgnoringCase("Authorization")));
	}

	@Test
	void preflightFromUnknownOriginIsRejected() throws Exception {
		mockMvc.perform(options("/api/private/me").header(HttpHeaders.ORIGIN, "http://evil.example")
			.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
			.andExpect(status().isForbidden())
			.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
	}

}
