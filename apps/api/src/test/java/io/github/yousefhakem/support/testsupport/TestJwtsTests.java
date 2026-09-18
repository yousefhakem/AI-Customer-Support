package io.github.yousefhakem.support.testsupport;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Date;

import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;

class TestJwtsTests {

	@Test
	void validTokenVerifiesAndCarriesClerkClaims() throws Exception {
		SignedJWT jwt = SignedJWT.parse(TestJwts.valid("org_123"));

		assertThat(jwt.verify(new RSASSAVerifier(TestJwts.publicJwk()))).isTrue();
		JWTClaimsSet claims = jwt.getJWTClaimsSet();
		assertThat(claims.getIssuer()).isEqualTo(TestJwts.ISSUER);
		assertThat(claims.getAudience()).containsExactly(TestJwts.AUDIENCE);
		assertThat(claims.getStringClaim("orgId")).isEqualTo("org_123");
		assertThat(claims.getStringClaim("family_name")).isNotBlank();
		assertThat(claims.getExpirationTime()).isAfter(new Date());
	}

	@Test
	void expiredTokenVerifiesButHasExpiryInThePast() throws Exception {
		SignedJWT jwt = SignedJWT.parse(TestJwts.expired("org_123"));

		assertThat(jwt.verify(new RSASSAVerifier(TestJwts.publicJwk()))).isTrue();
		assertThat(jwt.getJWTClaimsSet().getExpirationTime()).isBefore(new Date());
	}

	@Test
	void tokenSignedWithWrongKeyDoesNotVerify() throws Exception {
		SignedJWT jwt = SignedJWT.parse(TestJwts.signedWithWrongKey("org_123"));

		assertThat(jwt.verify(new RSASSAVerifier(TestJwts.publicJwk()))).isFalse();
	}

	@Test
	void tokenWithoutOrgIdVerifiesAndHasNoOrgIdClaim() throws Exception {
		SignedJWT jwt = SignedJWT.parse(TestJwts.withoutOrgId());

		assertThat(jwt.verify(new RSASSAVerifier(TestJwts.publicJwk()))).isTrue();
		assertThat(jwt.getJWTClaimsSet().getClaims()).doesNotContainKey("orgId");
	}

}
