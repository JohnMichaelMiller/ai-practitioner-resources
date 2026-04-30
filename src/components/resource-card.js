/**
 * Resource card rendering component
 */

import { getScoreColor, getWeeksBadgeColor } from "../core/colors.js";
import { getMainScore } from "../core/data-processor.js";
import { RISK_AREAS } from "../utils/constants.js";

/**
 * Build risk score badges HTML
 * @param {Object} riskCoverage - Risk coverage object from resource
 * @returns {string} HTML string for risk badges
 */
function buildRiskBadges(riskCoverage) {
  if (!riskCoverage) return "";

  const badges = RISK_AREAS.filter((area) => {
    const score = riskCoverage[area.key];
    return score && score !== "not_covered";
  })
    .map((area) => {
      const score = riskCoverage[area.key];
      const scoreColor = getScoreColor(score);
      return `<div class="individual-risk-score" style="background-color: ${scoreColor}">${area.icon}<div class="tooltip">${area.label}: ${area.tooltip.split(":")[0]} — Score: ${score}/100</div></div>`;
    })
    .join("");

  return badges;
}

/**
 * Get hostname from URL with error handling
 * @param {string} url - URL string
 * @returns {string} Hostname or fallback
 */
function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return url || "link";
  }
}

/**
 * Render a single resource card
 * @param {Object} resource - Resource object
 * @returns {string} HTML string for resource card
 */
export function renderResourceCard(resource) {
  const mainScore = getMainScore(resource);
  const scoreColor = getScoreColor(mainScore);
  const riskScoresBadges = buildRiskBadges(resource.risk_coverage);
  const hostname = getHostname(resource.source);

  return `
    <div class="resource-card">
      <div class="resource-header">
        <div class="resource-type-container">
          <span class="resource-type type-${resource.type.toLowerCase()}">${
            resource.type
          }</span>
          ${
            resource.weeks_on_list === 1
              ? '<span class="new-tag">NEW</span>'
              : ""
          }
          <div class="weeks-badge-header" style="border-color: ${getWeeksBadgeColor(
            resource.weeks_on_list || 1,
          )}; color: ${getWeeksBadgeColor(resource.weeks_on_list || 1)}">${
            resource.weeks_on_list || 1
          } week${resource.weeks_on_list !== 1 ? "s" : ""}</div>
        </div>
        <div class="score-header-container">
          <div class="score-header" style="background-color: ${scoreColor}">${mainScore}</div>
          ${
            riskScoresBadges
              ? `<div class="risk-scores-header">${riskScoresBadges}</div>`
              : ""
          }
        </div>
      </div>
      <div class="resource-title">${resource.title}</div>
      <div class="resource-source">
        <a href="${resource.source}" target="_blank">${hostname}</a>
      </div>
      <div class="resource-blurb">${resource.blurb}</div>
    </div>
  `;
}

/**
 * Render multiple resource cards
 * @param {Array} resources - Array of resource objects
 * @returns {string} HTML string for all resource cards
 */
export function renderResourceCards(resources) {
  return resources.map((resource) => renderResourceCard(resource)).join("");
}
