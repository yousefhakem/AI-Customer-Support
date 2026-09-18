package io.github.yousefhakem.support.common.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import io.swagger.v3.oas.annotations.Parameter;

/**
 * Binds the {@code orgId} claim of the authenticated Clerk JWT to a {@code String}
 * controller parameter. Rejects the request with {@code UNAUTHORIZED} when there is no
 * identity or no organization.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Parameter(hidden = true)
public @interface CurrentOrg {

}
