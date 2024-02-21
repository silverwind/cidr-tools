import m, {
  mergeCidr, excludeCidr, expandCidr, overlapCidr, normalizeCidr, containsCidr, parseCidr,
} from "./index.js";

mergeCidr(["::", "::"])
excludeCidr(["::"], ["::"])
expandCidr(["::", "::"])
overlapCidr(["::"], ["::"])
containsCidr(["::"], ["::"])
normalizeCidr("::")
normalizeCidr("::", {compress: true})
parseCidr("::")

m.mergeCidr(["::", "::"])
m.excludeCidr(["::"], ["::"])
m.expandCidr(["::", "::"])
m.overlapCidr(["::"], ["::"])
m.containsCidr(["::"], ["::"])
m.normalizeCidr("::")
m.normalizeCidr("::", {compress: true})
m.parseCidr("::")
