package io.github.yousefhakem.support.testsupport;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import com.nimbusds.jose.jwk.JWKSet;
import com.sun.net.httpserver.HttpServer;

/**
 * Serves {@link TestJwts#publicJwk()} as a JWKS on a random local port, standing in for
 * Clerk's {@code /.well-known/jwks.json}.
 */
final class JwksStubServer {

	private static final String PATH = "/.well-known/jwks.json";

	private static final HttpServer SERVER = start();

	private JwksStubServer() {
	}

	static String jwkSetUri() {
		return "http://localhost:" + SERVER.getAddress().getPort() + PATH;
	}

	private static HttpServer start() {
		byte[] body = new JWKSet(TestJwts.publicJwk()).toString().getBytes(StandardCharsets.UTF_8);
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
			server.createContext(PATH, (exchange) -> {
				exchange.getResponseHeaders().set("Content-Type", "application/json");
				exchange.sendResponseHeaders(200, body.length);
				try (OutputStream out = exchange.getResponseBody()) {
					out.write(body);
				}
			});
			server.start();
			return server;
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

}
