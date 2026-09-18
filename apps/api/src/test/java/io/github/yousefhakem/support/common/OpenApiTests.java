package io.github.yousefhakem.support.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class OpenApiTests {

	private final MockMvc mockMvc;

	@Autowired
	OpenApiTests(MockMvc mockMvc) {
		this.mockMvc = mockMvc;
	}

	@Test
	void apiDocsDescribeTheApiByTitle() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.info.title").value("AI Customer Support API"));
	}

	@Test
	void swaggerUiIndexIsServed() throws Exception {
		mockMvc.perform(get("/swagger-ui/index.html"))
			.andExpect(status().isOk());
	}

	@Test
	void swaggerUiPathRedirectsToIndex() throws Exception {
		mockMvc.perform(get("/swagger-ui"))
			.andExpect(status().is3xxRedirection());
	}

}
