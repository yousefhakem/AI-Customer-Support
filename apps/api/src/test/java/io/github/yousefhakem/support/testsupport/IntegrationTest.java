package io.github.yousefhakem.support.testsupport;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

	@Autowired
	protected MockMvc mockMvc;

	@DynamicPropertySource
	static void clerkJwtProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri", () -> TestJwts.ISSUER);
		registry.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri", JwksStubServer::jwkSetUri);
	}

}
