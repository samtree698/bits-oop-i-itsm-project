/**
 * IntelligenceService (PDF Page 9-10)
 * Implements automated & intelligent ITSM features:
 * A. Duplicate Incident Detection (Jaccard token similarity + service match)
 * B. Incident Correlation (Identifies open incidents sharing affected service/infrastructure)
 * D. Smart Technician Recommendation (Ranks technicians with explainable match score)
 * E. SLA Risk Detection (Identifies incidents >= 75% of SLA window or approaching breach)
 * F. Automated Incident Categorization (Keyword/NLP classification from description)
 * G. Suggested Historical Resolution (Retrieves proven fixes from past resolved/closed incidents)
 */
class IntelligenceService {
  constructor({ incidentRepo, categoryRepo, userRepo, serviceRepo }) {
    this.incidentRepo = incidentRepo;
    this.categoryRepo = categoryRepo;
    this.userRepo = userRepo;
    this.serviceRepo = serviceRepo;
  }

  tokenize(text) {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'unable', 'with', 'from', 'that', 'this', 'have', 'has', 'not', 'our', 'users', 'can'
    ]);
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));
  }

  calculateSimilarity(textA, textB) {
    const tokensA = new Set(this.tokenize(textA));
    const tokensB = new Set(this.tokenize(textB));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) intersection += 1;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return intersection / union;
  }

  /**
   * Feature F: Automatically suggest an incident category based on description
   */
  async suggestCategory(title = '', description = '') {
    const combined = `${title} ${description}`.toLowerCase();
    const categories = await this.categoryRepo.findAll();

    const defaultKeywordMap = {
      Application: ['payment', 'transaction', 'checkout', 'portal', 'erp', 'crm', 'app', 'application', 'ui', 'bug'],
      Network: ['network', 'vpn', 'wifi', 'router', 'switch', 'dns', 'firewall', 'packet', 'latency', 'internet'],
      Database: ['database', 'mongodb', 'sql', 'postgres', 'query', 'deadlock', 'replica', 'table', 'connection pool'],
      Authentication: ['login', 'password', 'sso', 'oauth', 'jwt', 'mfa', 'ldap', 'authentication', 'access denied'],
      Cloud: ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'pod', 'cloud', 'instance', 'cluster'],
      Security: ['malware', 'phishing', 'breach', 'unauthorized', 'vulnerability', 'ddos', 'certificate', 'ssl'],
      Storage: ['disk', 'storage', 's3', 'backup', 'nas', 'san', 'quota', 'file share', 'volume'],
      Hardware: ['laptop', 'printer', 'server rack', 'monitor', 'UPS', 'keyboard', 'hardware', 'motherboard'],
      Software: ['office', 'ide', 'license', 'install', 'update', 'driver', 'os', 'windows', 'linux']
    };

    let bestCategory = 'Application';
    let highestHits = 0;
    const matchedKeywords = [];

    for (const cat of categories) {
      if (!cat.active) continue;
      const keywords = cat.keywords?.length ? cat.keywords : defaultKeywordMap[cat.name] || [];
      let hits = 0;
      for (const kw of keywords) {
        if (combined.includes(kw.toLowerCase())) {
          hits += 1;
          matchedKeywords.push(kw);
        }
      }
      if (hits > highestHits) {
        highestHits = hits;
        bestCategory = cat.name;
      }
    }

    return {
      suggestedCategory: bestCategory,
      confidence: highestHits > 0 ? Math.min(0.96, 0.55 + highestHits * 0.15) : 0.45,
      matchedKeywords: [...new Set(matchedKeywords)]
    };
  }

  /**
   * Feature A & B: Duplicate Incident Detection & Service Correlation
   */
  async detectDuplicatesAndCorrelations({ title, description, serviceId, excludeIncidentId = null }) {
    const allIncidents = await this.incidentRepo.findAll();
    const activeIncidents = allIncidents.filter(
      (inc) => inc.incidentId !== excludeIncidentId && inc.status !== 'CLOSED'
    );

    const duplicates = [];
    const correlated = [];
    const queryText = `${title} ${description}`;

    for (const existing of activeIncidents) {
      const existingText = `${existing.title} ${existing.description}`;
      const textSim = this.calculateSimilarity(queryText, existingText);
      const sameService = existing.serviceId === serviceId;
      const combinedScore = sameService ? Math.min(1, textSim + 0.25) : textSim;

      if (combinedScore >= 0.42) {
        duplicates.push({
          incidentId: existing.incidentId,
          title: existing.title,
          status: existing.status,
          similarityScore: Number(combinedScore.toFixed(2))
        });
      }

      if (sameService) {
        correlated.push({
          incidentId: existing.incidentId,
          title: existing.title,
          priority: existing.priority,
          status: existing.status
        });
      }
    }

    duplicates.sort((a, b) => b.similarityScore - a.similarityScore);
    return {
      isPotentialDuplicate: duplicates.length > 0,
      duplicates,
      correlatedIncidents: correlated
    };
  }

  /**
   * Feature G: Suggested Resolution from Historical Resolved/Closed Incidents
   */
  async suggestHistoricalResolution({ title, description, category, serviceId }) {
    const allIncidents = await this.incidentRepo.findAll();
    const historical = allIncidents.filter(
      (inc) => ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(inc.status) && inc.resolution?.resolutionSummary
    );

    const queryText = `${title} ${description}`;
    const scored = historical.map((inc) => {
      let score = this.calculateSimilarity(queryText, `${inc.title} ${inc.description}`);
      if (inc.serviceId === serviceId) score += 0.3;
      if (inc.category === category) score += 0.2;
      return { incident: inc, score };
    });

    scored.sort((a, b) => b.score - a.score);
    if (scored.length > 0 && scored[0].score >= 0.25) {
      const top = scored[0].incident;
      return {
        sourceIncidentId: top.incidentId,
        rootCause: top.resolution.rootCause,
        recommendedFix: top.resolution.resolutionSummary,
        confidence: Number(Math.min(0.95, scored[0].score).toFixed(2))
      };
    }

    const fallbackGuides = {
      Application: 'Verify application worker pool health, inspect recent deployment logs, and restart degraded microservice instances.',
      Network: 'Check core router BGP/OSPF peers, verify VPN tunnel status, and flush DNS cache on edge gateway.',
      Database: 'Inspect active connection pool utilization, terminate long-running blocking queries, and verify replica lag.',
      Authentication: 'Validate SSO/LDAP identity provider reachability and check token signing certificate expiration.',
      Cloud: 'Inspect Kubernetes pod crash loops, check cloud auto-scaling quotas, and verify load balancer target health.'
    };

    return {
      sourceIncidentId: 'KNOWLEDGE_BASE',
      rootCause: `Standard ${category || 'IT'} diagnostic runbook`,
      recommendedFix: fallbackGuides[category] || fallbackGuides.Application,
      confidence: 0.6
    };
  }

  /**
   * Feature D: Smart Technician Recommendation
   */
  async recommendTechnicians({ category, serviceId, priority }) {
    const technicians = await this.userRepo.findTechnicians();
    const ranked = technicians.map((tech) => {
      const skillMatch = tech.hasSkill(category);
      const serviceExp = tech.hasServiceExperience(serviceId);
      const capacityRatio = 1 - tech.currentWorkload / tech.maxWorkload;

      let score = 0;
      if (skillMatch) score += 45;
      if (serviceExp) score += 25;
      score += Math.min(15, tech.experienceYears * 2.5);
      score += Math.max(0, capacityRatio * 15);
      if (!tech.available || !tech.active || tech.currentWorkload >= tech.maxWorkload) {
        score = -10;
      }

      return {
        technicianId: tech.id,
        name: tech.name,
        email: tech.email,
        skills: tech.skills,
        experienceYears: tech.experienceYears,
        currentWorkload: tech.currentWorkload,
        maxWorkload: tech.maxWorkload,
        available: tech.available,
        canAccept: tech.canAcceptAssignment(),
        matchScore: Math.round(score),
        reasons: [
          skillMatch ? `Matches '${category}' skill` : `General support`,
          serviceExp ? `Experienced with ${serviceId}` : null,
          `Workload ${tech.currentWorkload}/${tech.maxWorkload}`
        ].filter(Boolean)
      };
    });

    ranked.sort((a, b) => b.matchScore - a.matchScore);
    return ranked;
  }
}

module.exports = { IntelligenceService };
