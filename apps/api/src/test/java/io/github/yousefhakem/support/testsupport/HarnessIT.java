package io.github.yousefhakem.support.testsupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

class HarnessIT extends IntegrationTest {

	@Autowired
	private JdbcClient jdbcClient;

	@Test
	void flywayAppliesBaselineMigration() {
		Boolean success = jdbcClient.sql("select success from flyway_schema_history where version = '1'")
			.query(Boolean.class)
			.single();

		assertThat(success).isTrue();
	}

	@Test
	void vectorExtensionIsInstalled() {
		Long count = jdbcClient.sql("select count(*) from pg_extension where extname = 'vector'")
			.query(Long.class)
			.single();

		assertThat(count).isEqualTo(1L);
	}

	@Test
	void pgvectorComputesDistances() {
		Double distance = jdbcClient.sql("select '[1,2,3]'::vector <-> '[1,2,4]'::vector")
			.query(Double.class)
			.single();

		assertThat(distance).isEqualTo(1.0);
	}

	@Test
	void mockMvcReachesTheRunningApplication() throws Exception {
		mockMvc.perform(get("/actuator/health"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("UP"));
	}

}
