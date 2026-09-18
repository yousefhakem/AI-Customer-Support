package io.github.yousefhakem.support.common.auth;

import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import io.github.yousefhakem.support.common.error.UnauthorizedException;

class CurrentOrgArgumentResolver implements HandlerMethodArgumentResolver {

	@Override
	public boolean supportsParameter(MethodParameter parameter) {
		return parameter.hasParameterAnnotation(CurrentOrg.class) && parameter.getParameterType() == String.class;
	}

	@Override
	public String resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
			NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
			throw new UnauthorizedException("Identity not found");
		}
		String orgId = jwt.getClaimAsString("orgId");
		if (!StringUtils.hasText(orgId)) {
			throw new UnauthorizedException("Organization not found");
		}
		return orgId;
	}

}
