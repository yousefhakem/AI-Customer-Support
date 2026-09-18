package io.github.yousefhakem.support.me;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.github.yousefhakem.support.common.auth.CurrentOrg;
import io.github.yousefhakem.support.me.dto.MeResponse;

@RestController
@RequestMapping("/api/private/me")
public class MeController {

	@GetMapping
	public MeResponse me(@CurrentOrg String orgId, @AuthenticationPrincipal Jwt jwt) {
		return new MeResponse(orgId, jwt.getSubject());
	}

}
