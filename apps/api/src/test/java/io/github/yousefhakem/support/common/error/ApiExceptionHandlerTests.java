package io.github.yousefhakem.support.common.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest
@AutoConfigureMockMvc
@Import(ApiExceptionHandlerTests.ThrowingController.class)
class ApiExceptionHandlerTests {

	private final MockMvc mockMvc;

	@Autowired
	ApiExceptionHandlerTests(MockMvc mockMvc) {
		this.mockMvc = mockMvc;
	}

	@Test
	void notFoundExceptionBecomes404WithNotFoundCode() throws Exception {
		mockMvc.perform(get("/test-errors/not-found"))
			.andExpect(status().isNotFound())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("NOT_FOUND"))
			.andExpect(jsonPath("$.detail").value("Conversation not found"))
			.andExpect(jsonPath("$.title").value("Not Found"))
			.andExpect(jsonPath("$.status").value(404));
	}

	@Test
	void badRequestExceptionBecomes400WithBadRequestCode() throws Exception {
		mockMvc.perform(get("/test-errors/bad-request"))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("BAD_REQUEST"))
			.andExpect(jsonPath("$.detail").value("Invalid session"));
	}

	@Test
	void unauthorizedExceptionBecomes401WithUnauthorizedCode() throws Exception {
		mockMvc.perform(get("/test-errors/unauthorized"))
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.detail").value("Identity not found"));
	}

	@Test
	void unknownRouteBecomes404ProblemDetail() throws Exception {
		mockMvc.perform(get("/no-such-route"))
			.andExpect(status().isNotFound())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(404));
	}

	@RestController
	static class ThrowingController {

		@GetMapping("/test-errors/not-found")
		void notFound() {
			throw new NotFoundException("Conversation not found");
		}

		@GetMapping("/test-errors/bad-request")
		void badRequest() {
			throw new BadRequestException("Invalid session");
		}

		@GetMapping("/test-errors/unauthorized")
		void unauthorized() {
			throw new UnauthorizedException("Identity not found");
		}

	}

}
