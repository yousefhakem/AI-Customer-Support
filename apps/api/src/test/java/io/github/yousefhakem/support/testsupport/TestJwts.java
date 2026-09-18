package io.github.yousefhakem.support.testsupport;

import java.time.Instant;
import java.util.Date;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

/**
 * Mints Clerk-shaped RS256 JWTs for tests.
 */
public final class TestJwts {

	public static final String ISSUER = "https://clerk.test.local";

	public static final String AUDIENCE = "api";

	private static final RSAKey KEY = generateKey("test-key");

	private static final RSAKey OTHER_KEY = generateKey("other-key");

	private TestJwts() {
	}

	public static String valid(String orgId) {
		return sign(KEY, orgId, Instant.now());
	}

	public static String expired(String orgId) {
		return sign(KEY, orgId, Instant.now().minusSeconds(3600));
	}

	public static String signedWithWrongKey(String orgId) {
		return sign(OTHER_KEY, orgId, Instant.now());
	}

	public static String withoutOrgId() {
		return sign(KEY, null, Instant.now());
	}

	public static RSAKey publicJwk() {
		return KEY.toPublicJWK();
	}

	private static String sign(RSAKey key, String orgId, Instant issuedAt) {
		JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
			.issuer(ISSUER)
			.subject("user_test")
			.audience(AUDIENCE)
			.claim("azp", "http://localhost:3000")
			.issueTime(Date.from(issuedAt))
			.notBeforeTime(Date.from(issuedAt))
			.expirationTime(Date.from(issuedAt.plusSeconds(300)))
			.claim("sid", "sess_test")
			.claim("family_name", "Tester");
		if (orgId != null) {
			claims.claim("orgId", orgId);
		}
		SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),
				claims.build());
		try {
			jwt.sign(new RSASSASigner(key));
		}
		catch (JOSEException ex) {
			throw new IllegalStateException(ex);
		}
		return jwt.serialize();
	}

	private static RSAKey generateKey(String keyId) {
		try {
			return new RSAKeyGenerator(2048).keyID(keyId).generate();
		}
		catch (JOSEException ex) {
			throw new IllegalStateException(ex);
		}
	}

}
