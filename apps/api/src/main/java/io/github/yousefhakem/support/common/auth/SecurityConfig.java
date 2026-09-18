package io.github.yousefhakem.support.common.auth;

import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.HandlerExceptionResolver;

import io.github.yousefhakem.support.common.error.UnauthorizedException;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AuthenticationEntryPoint authenticationEntryPoint) {
		http.csrf((csrf) -> csrf.disable())
			.cors(Customizer.withDefaults())
			.sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests((requests) -> requests.requestMatchers("/api/private/**")
				.authenticated()
				.anyRequest()
				.permitAll())
			.oauth2ResourceServer((resourceServer) -> resourceServer.jwt(Customizer.withDefaults())
				.authenticationEntryPoint(authenticationEntryPoint))
			.exceptionHandling((exceptions) -> exceptions.authenticationEntryPoint(authenticationEntryPoint));
		return http.build();
	}

	/**
	 * Sets the {@code WWW-Authenticate: Bearer} header, then lets
	 * {@link io.github.yousefhakem.support.common.error.ApiExceptionHandler} write the
	 * ProblemDetail body.
	 */
	@Bean
	AuthenticationEntryPoint authenticationEntryPoint(
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver handlerExceptionResolver) {
		BearerTokenAuthenticationEntryPoint bearerEntryPoint = new BearerTokenAuthenticationEntryPoint();
		return (request, response, authException) -> {
			bearerEntryPoint.commence(request, response, authException);
			handlerExceptionResolver.resolveException(request, response, null,
					new UnauthorizedException("Identity not found"));
		};
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(@Value("${app.cors.origins}") List<String> allowedOrigins) {
		CorsConfiguration cors = new CorsConfiguration();
		cors.setAllowedOrigins(allowedOrigins);
		cors.setAllowedMethods(List.of(HttpMethod.GET.name(), HttpMethod.POST.name(), HttpMethod.PUT.name(),
				HttpMethod.PATCH.name(), HttpMethod.DELETE.name(), HttpMethod.OPTIONS.name()));
		cors.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE));
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", cors);
		return source;
	}

}
