package io.github.yousefhakem.support.common.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import io.github.yousefhakem.support.testsupport.IntegrationTest;

class CurrentOrgOpenApiTests extends IntegrationTest {

	@Test
	void apiDocsDescribeMeEndpointWithoutExposingOrgIdAsParameter() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.paths['/api/private/me'].get").exists())
			.andExpect(jsonPath("$.paths['/api/private/me'].get.parameters").doesNotExist());
	}

}
