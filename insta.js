addEventListener("fetch", e => e.respondWith(handle(e.request)));

var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function j(o, s) {
  return new Response(JSON.stringify(o, null, 2), {
    status: s || 200,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

function safeNum(v) { return typeof v === "number" ? v : null; }
function safeStr(v) { return typeof v === "string" && v.length > 0 ? v : null; }
function safeBool(v) { return typeof v === "boolean" ? v : false; }

function genId() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8); return v.toString(16); }); }

async function getApiHeaders(name) {
  var ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  var cookieStr = "";
  var csrf = "";
  var mid = "";
  var failCount = 0;
  var htmlText = "";
  while (failCount < 2) {
    try {
      var url = failCount === 0 ? "https://www.instagram.com/" : "https://www.instagram.com/" + encodeURIComponent(name) + "/";
      var htmlRes = await fetch(url, {
        headers: { "User-Agent": ua, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Origin": "https://www.instagram.com", "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "none", "Upgrade-Insecure-Requests": "1" },
        redirect: "follow"
      });
      var sc = htmlRes.headers.get("set-cookie") || "";
      if (!sc) {
        var allHeaders = "";
        htmlRes.headers.forEach(function(v, k) { allHeaders += k + ": " + v + "\n"; });
        sc = allHeaders.match(/set-cookie[^:]*:\s*([^\n]+)/i);
        sc = sc ? sc[1] : "";
      }
      var mCsrf = sc.match(/csrftoken=([^;]+)/);
      var mMid = sc.match(/mid=([^;]+)/);
      if (mCsrf) csrf = mCsrf[1];
      if (mMid) mid = mMid[1];
      if (mid) cookieStr = "mid=" + mid + "; ";
      if (csrf) cookieStr += "csrftoken=" + csrf + "; ";
      if (!csrf) {
        htmlText = await htmlRes.text();
        var csrfMatch = htmlText.match(/csrf_token["']?\s*[:=]\s*["']([^"']+)/);
        if (csrfMatch) { csrf = csrfMatch[1]; cookieStr += "csrftoken=" + csrf + "; "; }
      }
    } catch (e) {}
    if (csrf) break;
    failCount++;
  }
  var deviceId = genId().toUpperCase();
  var sessionId = Math.random().toString(36).substring(2, 8) + ":" + Math.random().toString(36).substring(2, 8) + ":" + Math.random().toString(36).substring(2, 8);
  var headers = {
    "User-Agent": ua, "x-ig-app-id": "936619743392459", "x-csrftoken": csrf || "missing",
    "x-requested-with": "XMLHttpRequest", "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9",
    "x-web-device-id": deviceId, "x-web-session-id": sessionId, "x-ig-max-touch-points": "0",
    "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "same-origin",
    "Origin": "https://www.instagram.com",
    "Sec-Ch-Ua": '"Google Chrome";v="126", "Chromium";v="126", "Not)A;Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0", "Sec-Ch-Ua-Platform": '"Windows"',
    "Referer": "https://www.instagram.com/" + name + "/",
  };
  if (cookieStr) headers["Cookie"] = cookieStr.trim();
  return headers;
}

function xMusic(src) {
  if (!src) return null;
  var mi = src.music_info || (src.clips_metadata && src.clips_metadata.music_info) || src.music_metadata;
  if (!mi) return null;
  return {
    id: safeStr(mi.music_asset_id || mi.audio_asset_id), title: safeStr(mi.music_name), artist: safeStr(mi.artist_name),
    album: safeStr(mi.album_name), duration_ms: safeNum(mi.duration_ms), is_original: safeBool(mi.is_original_audio),
    original_sound: mi.original_sound_info ? { username: safeStr(mi.original_sound_info.username), full_name: safeStr(mi.original_sound_info.full_name), profile_pic: safeStr(mi.original_sound_info.profile_pic_url), is_verified: safeBool(mi.original_sound_info.is_verified) } : null,
    cover_art: safeStr(mi.cover_art_url || mi.album_cover_url), uri: safeStr(mi.uri || mi.progressive_share_url), upbeat: safeStr(mi.upbeat_type),
    providers: mi.music_consumption_info ? mi.music_consumption_info.map(function(p) { return { id: safeStr(p.audio_asset_id), provider: safeStr(p.provider), display_name: safeStr(p.display_name) }; }) : null
  };
}

function xLoc(loc) {
  if (!loc || !loc.name) return null;
  return { id: safeStr(loc.id), name: safeStr(loc.name), slug: safeStr(loc.slug), address: safeStr(loc.address), city: safeStr(loc.city), short_name: safeStr(loc.short_name), phone: safeStr(loc.phone), website: safeStr(loc.website), latitude: safeNum(loc.lat), longitude: safeNum(loc.lng) };
}

function xSponsor(arr) {
  if (!arr || !arr.length) return null;
  var s = arr[0];
  return { id: safeStr(s.id || s.sponsor_id), username: safeStr(s.username), full_name: safeStr(s.full_name), profile_pic: safeStr(s.profile_pic_url) };
}

function xVids(vv) {
  if (!vv || !Array.isArray(vv) || !vv.length) return null;
  return vv.map(function(v) { return { url: safeStr(v.url), width: safeNum(v.width), height: safeNum(v.height), type: safeStr(v.type), bitrate: safeNum(v.bitrate), id: safeStr(v.id) }; });
}

function xImgs(iv) {
  if (!iv || !iv.candidates || !iv.candidates.length) return null;
  return iv.candidates.map(function(c) { return { url: safeStr(c.url), width: safeNum(c.width), height: safeNum(c.height) }; });
}

function xCarousel(items) {
  if (!items || !items.length) return null;
  return items.map(function(c) {
    var url = safeStr(c.display_url || ((c.image_versions2 && c.image_versions2.candidates && c.image_versions2.candidates[0] && c.image_versions2.candidates[0].url)));
    return {
      id: safeStr(c.id), type: c.media_type === 2 ? "video" : c.media_type === 1 ? "photo" : "unknown",
      display_url: url, video_url: safeStr(c.video_url), video_versions: xVids(c.video_versions), image_versions: xImgs(c.image_versions2),
      thumbnail: safeStr(c.thumbnail_src), alt_text: safeStr(c.alt_text || c.accessibility_caption),
      caption: c.caption ? safeStr(c.caption.text) : null, taken_at: safeNum(c.taken_at), music: xMusic(c),
      product_type: safeStr(c.product_type), video_duration: safeNum(c.video_duration), has_audio: safeBool(c.has_audio)
    };
  });
}

function xPost(n) {
  var t = n.__typename;
  var type = t === "GraphImage" ? "photo" : t === "GraphVideo" ? "video" : t === "GraphSidecar" ? "carousel" : t === "GraphReel" ? "reel" : (t || "unknown").replace("Graph", "").toLowerCase();
  
  var carouselData = n.carousel_media;
  if ((!carouselData || !carouselData.length) && n.edge_sidecar_to_children && n.edge_sidecar_to_children.edges) {
    carouselData = n.edge_sidecar_to_children.edges.map(function(e) { return e.node; });
  }
  var carousel = xCarousel(carouselData);

  var capText = "";
  if (n.edge_media_to_caption && n.edge_media_to_caption.edges && n.edge_media_to_caption.edges[0] && n.edge_media_to_caption.edges[0].node) capText = n.edge_media_to_caption.edges[0].node.text || "";
  else if (n.caption && n.caption.text) capText = n.caption.text;
  else if (typeof n.caption === "string") capText = n.caption;

  var thumbSrc = safeStr(n.thumbnail_src);
  if (!thumbSrc && n.image_versions2 && n.image_versions2.candidates && n.image_versions2.candidates[0]) thumbSrc = safeStr(n.image_versions2.candidates[0].url);
  
  var imgVersions = xImgs(n.image_versions2);
  if (!imgVersions && n.display_url) {
    imgVersions = [{ url: safeStr(n.display_url), width: safeNum(n.dimensions ? n.dimensions.width : null), height: safeNum(n.dimensions ? n.dimensions.height : null) }];
  }

  var vidVersions = xVids(n.video_versions);
  var vidUrl = safeStr(n.video_url);
  if (!vidVersions && vidUrl && n.dimensions) {
    vidVersions = [{ url: vidUrl, width: safeNum(n.dimensions.width), height: safeNum(n.dimensions.height), type: "mp4", bitrate: null, id: null }];
  }

  var topComments = [];
  if (n.edge_media_to_parent_comment && n.edge_media_to_parent_comment.edges) {
    topComments = n.edge_media_to_parent_comment.edges.slice(0, 3).map(function(ce) {
      return {
        id: safeStr(ce.node.id), text: safeStr(ce.node.text), created_at: safeNum(ce.node.created_at),
        created_at_iso: ce.node.created_at ? new Date(ce.node.created_at * 1000).toISOString() : null,
        likes: safeNum(ce.node.edge_liked_by ? ce.node.edge_liked_by.count : null),
        owner: { id: safeStr(ce.node.owner.id), username: safeStr(ce.node.owner.username), profile_pic: safeStr(ce.node.owner.profile_pic_url), is_verified: safeBool(ce.node.owner.is_verified) }
      };
    });
  }

  var taggedUsers = null;
  if (n.edge_media_to_tagged_user && n.edge_media_to_tagged_user.edges) {
    taggedUsers = n.edge_media_to_tagged_user.edges.map(function(tu) {
      var tuNode = tu.node;
      return {
        id: safeStr(tuNode.user ? tuNode.user.id : null),
        username: safeStr(tuNode.user ? tuNode.user.username : null),
        full_name: safeStr(tuNode.user ? tuNode.user.full_name : null),
        is_verified: safeBool(tuNode.user ? tuNode.user.is_verified : false),
        x: safeNum(tuNode.x), y: safeNum(tuNode.y)
      };
    });
  }

  var coauthors = null;
  if (n.coauthor_producers && n.coauthor_producers.length) {
    coauthors = n.coauthor_producers.map(function(ca) {
      return { id: safeStr(ca.id), username: safeStr(ca.username), full_name: safeStr(ca.full_name), profile_pic: safeStr(ca.profile_pic_url), is_verified: safeBool(ca.is_verified) };
    });
  }

  var clipsMusic = null;
  if (n.clips_music_attribution_info) {
    clipsMusic = {
      artist_name: safeStr(n.clips_music_attribution_info.artist_name),
      song_name: safeStr(n.clips_music_attribution_info.song_name),
      uses_original_audio: safeBool(n.clips_music_attribution_info.uses_original_audio),
      should_mute_audio: safeBool(n.clips_music_attribution_info.should_mute_audio),
      should_mute_audio_reason: safeStr(n.clips_music_attribution_info.should_mute_audio_reason),
      audio_id: safeStr(n.clips_music_attribution_info.audio_id)
    };
  }

  var thumbResources = null;
  if (n.thumbnail_resources && Array.isArray(n.thumbnail_resources)) {
    thumbResources = n.thumbnail_resources.map(function(tr) {
      return { url: safeStr(tr.src), width: safeNum(tr.config_width), height: safeNum(tr.config_height) };
    });
  }

  var sharingFriction = null;
  if (n.sharing_friction_info) {
    sharingFriction = {
      should_have_sharing_friction: safeBool(n.sharing_friction_info.should_have_sharing_friction),
      bloks_app_url: safeStr(n.sharing_friction_info.bloks_app_url)
    };
  }

  var dashInfo = null;
  if (n.dash_info) {
    dashInfo = {
      is_dash_eligible: safeBool(n.dash_info.is_dash_eligible),
      video_dash_manifest: safeStr(n.dash_info.video_dash_manifest),
      number_of_qualities: safeNum(n.dash_info.number_of_qualities)
    };
  }

  var htMatch = capText.match(/#[\w]+/g);
  return {
    id: safeStr(n.id), shortcode: safeStr(n.shortcode), type: type, display_url: safeStr(n.display_url), thumbnail_src: thumbSrc,
    thumbnail_tall_src: safeStr(n.thumbnail_tall_src), thumbnail_resources: thumbResources,
    image_versions: imgVersions, video_url: vidUrl, video_versions: vidVersions,
    dimensions: n.dimensions ? { width: safeNum(n.dimensions.width), height: safeNum(n.dimensions.height) } : null,
    caption: safeStr(capText), caption_is_edited: safeBool(n.caption_is_edited),
    taken_at: safeNum(n.taken_at_timestamp), taken_at_iso: n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : null,
    expiring_at: safeNum(n.expiring_at),
    likes: safeNum(n.edge_media_preview_like ? n.edge_media_preview_like.count : (n.edge_liked_by ? n.edge_liked_by.count : n.like_count)),
    comments: safeNum(n.edge_media_to_comment ? n.edge_media_to_comment.count : n.comment_count),
    views: safeNum(n.video_view_count || n.view_count), plays: safeNum(n.play_count), impressions: safeNum(n.impressions), reach: safeNum(n.reach), saves: safeNum(n.saved_count),
    like_and_view_counts_disabled: safeBool(n.like_and_view_counts_disabled),
    music: xMusic(n), location: xLoc(n.location), carousel_media: carousel, carousel_count: carousel ? carousel.length : null,
    alt_text: safeStr(n.accessibility_caption), is_paid_partnership: safeBool(n.is_paid_partnership),
    sponsor: xSponsor(n.sponsor_tags) || xSponsor(n.edge_media_to_sponsored_user ? n.edge_media_to_sponsored_user.edges.map(function(e) { return e.node; }) : null),
    product_type: safeStr(n.product_type), commerciality_status: safeStr(n.commerciality_status),
    shopping: n.shopping ? { product_type: safeStr(n.shopping.product_type), is_product_pin: safeBool(n.shopping.is_product_pin), product_id: safeStr(n.shopping.product_id) } : null,
    is_video: safeBool(n.is_video), has_audio: safeBool(n.has_audio), video_duration: safeNum(n.video_duration),
    has_upcoming_event: safeBool(n.has_upcoming_event),
    dash_info: dashInfo,
    coauthor: coauthors, tagged_users: taggedUsers,
    clips_music: clipsMusic,
    title: safeStr(n.title), comments_disabled: safeBool(n.comments_disabled || n.commenting_disabled_for_viewer),
    viewer_has_liked: safeBool(n.viewer_has_liked), viewer_has_saved: safeBool(n.viewer_has_saved), viewer_can_reshare: safeBool(n.viewer_can_reshare),
    pinned: Array.isArray(n.pinned_for_users) && n.pinned_for_users.length > 0,
    sharing_friction: sharingFriction,
    media_preview: safeStr(n.media_preview),
    fact_check: n.fact_check_overall_rating ? { overall_rating: safeStr(n.fact_check_overall_rating), information: n.fact_check_information ? n.fact_check_information.map(function(fi) { return { text: safeStr(fi.text), url: safeStr(fi.url) }; }) : null } : null,
    top_comments: topComments, hashtags: htMatch && htMatch.length > 0 ? htMatch : null
  };
}

function xBioLinks(links) {
  if (!links || !Array.isArray(links) || !links.length) return null;
  return links.map(function(l) {
    var url = safeStr(l.url);
    if (!url && l.pathname) url = "https://www.instagram.com" + l.pathname;
    return { url: url, lynx_url: safeStr(l.lynx_url), title: safeStr(l.title), icon_url: safeStr(l.icon_url), is_pinned: safeBool(l.is_pinned), link_type: safeStr(l.link_type) };
  });
}

function xProfile(u) {
  var blResult = xBioLinks(u.bio_links);
  if (!blResult && u.link_in_bio_style && u.link_in_bio_style.link_in_bio_links) blResult = xBioLinks(u.link_in_bio_style.link_in_bio_links);
  var hdPics = null;
  if (u.hd_profile_pic_versions) hdPics = u.hd_profile_pic_versions.map(function(v) { return { url: safeStr(v.url), width: safeNum(v.width), height: safeNum(v.height) }; });
  var aboutObj = null;
  if (u.about) {
    aboutObj = { about_text: safeStr(u.about.about_text), public_email: safeStr(u.about.public_email), public_phone_number: safeStr(u.about.public_phone_number), biography_entities: null };
    if (u.about.biography_entities) aboutObj.biography_entities = u.about.biography_entities.map(function(e) { return { entity_name: safeStr(e.entity_name), entity_type: safeStr(e.entity_type) }; });
  }
  var pageInfo = null;
  if (u.edge_owner_to_timeline_media && u.edge_owner_to_timeline_media.page_info) pageInfo = { has_next_page: safeBool(u.edge_owner_to_timeline_media.page_info.has_next_page), end_cursor: safeStr(u.edge_owner_to_timeline_media.page_info.end_cursor) };

  var bioEntities = null;
  if (u.biography_with_entities && u.biography_with_entities.entities) {
    bioEntities = u.biography_with_entities.entities.map(function(e) { return { name: safeStr(e.entity_name || e.name), type: safeStr(e.entity_type || e.type), offset: safeNum(e.offset), length: safeNum(e.length) }; });
  }

  var mutualFollowers = null;
  if (u.edge_mutual_followed_by) mutualFollowers = { count: safeNum(u.edge_mutual_followed_by.count) };

  var relatedProfiles = null;
  if (u.edge_related_profiles && u.edge_related_profiles.edges) {
    relatedProfiles = u.edge_related_profiles.edges.map(function(e) { return { id: safeStr(e.node.id), username: safeStr(e.node.username), full_name: safeStr(e.node.full_name), profile_pic: safeStr(e.node.profile_pic_url), is_verified: safeBool(e.node.is_verified) }; });
  }

  return {
    id: safeStr(u.id), pk: safeStr(u.pk), fbid: safeStr(u.fbid), username: safeStr(u.username), full_name: safeStr(u.full_name),
    biography: safeStr(u.biography), biography_with_entities: bioEntities, bio_links: blResult, external_url: safeStr(u.external_url), external_url_linkshimmed: safeStr(u.external_url_linkshimmed),
    profile_pic_url: safeStr(u.profile_pic_url_hd || u.profile_pic_url), profile_pic_url_hd: safeStr(u.profile_pic_url_hd), hd_profile_pic_versions: hdPics,
    is_verified: safeBool(u.is_verified), is_verified_by_mv4b: safeBool(u.is_verified_by_mv4b), is_private: safeBool(u.is_private),
    followers: safeNum(u.edge_followed_by ? u.edge_followed_by.count : null), following: safeNum(u.edge_follow ? u.edge_follow.count : null),
    followers_viewer: safeBool(u.followed_by_viewer), follows_viewer: safeBool(u.follows_viewer), requested_by_viewer: safeBool(u.requested_by_viewer), has_requested_viewer: safeBool(u.has_requested_viewer),
    posts: safeNum(u.edge_owner_to_timeline_media ? u.edge_owner_to_timeline_media.count : null), highlight_reel_count: safeNum(u.highlight_reel_count),
    is_business_account: safeBool(u.is_business_account), is_professional_account: safeBool(u.is_professional_account),
    category_name: safeStr(u.category_name), overall_category_name: safeStr(u.overall_category_name), category_enum: safeStr(u.category_enum),
    business_email: safeStr(u.business_email), business_phone_number: safeStr(u.business_phone_number), business_contact_method: safeStr(u.business_contact_method), business_address_json: safeStr(u.business_address_json),
    pronouns: safeStr(u.pronouns), about: aboutObj,
    is_embeds_disabled: safeBool(u.is_embeds_disabled), is_joined_recently: safeBool(u.is_joined_recently), is_regulated_c18: safeBool(u.is_regulated_c18),
    blocked_by_viewer: safeBool(u.blocked_by_viewer), restricted_by_viewer: safeBool(u.restricted_by_viewer), has_blocked_viewer: safeBool(u.has_blocked_viewer),
    country_block: safeBool(u.country_block), eimu_id: safeStr(u.eimu_id),
    has_clips: safeBool(u.has_clips), has_guides: safeBool(u.has_guides), has_channel: safeBool(u.has_channel), has_ar_effects: safeBool(u.has_ar_effects), has_onboarded_to_text_post_app: safeBool(u.has_onboarded_to_text_post_app),
    hide_like_and_view_counts: safeBool(u.hide_like_and_view_counts), show_account_transparency_details: safeBool(u.show_account_transparency_details),
    is_supervision_enabled: safeBool(u.is_supervision_enabled), is_supervised_user: safeBool(u.is_supervised_user), is_supervised_by_viewer: safeBool(u.is_supervised_by_viewer), is_guardian_of_viewer: safeBool(u.is_guardian_of_viewer),
    should_show_category: safeBool(u.should_show_category), should_show_public_contacts: safeBool(u.should_show_public_contacts),
    transparency_label: safeStr(u.transparency_label), transparency_product: safeStr(u.transparency_product),
    ai_agent: u.ai_agent_type ? { type: safeStr(u.ai_agent_type), owner_username: safeStr(u.ai_agent_owner_username) } : null,
    pinned_channels_list_count: safeNum(u.pinned_channels_list_count),
    mutual_followers: mutualFollowers, related_profiles: relatedProfiles,
    fb_profile_biolink: safeStr(u.fb_profile_biolink),
    feed_edge: { count: safeNum(u.edge_owner_to_timeline_media ? u.edge_owner_to_timeline_media.count : null), page_info: pageInfo }
  };
}

function xHighlights(edges) {
  if (!edges || !edges.length) return null;
  return edges.map(function(h) {
    var reel = h.node;
    var items = (reel.highlight_reel_items || []).map(function(it) {
      return {
        id: safeStr(it.id), type: it.media_type === 2 ? "video" : "photo",
        display_url: safeStr(((it.image_versions2 && it.image_versions2.candidates && it.image_versions2.candidates[0] && it.image_versions2.candidates[0].url) || it.display_url)),
        video_url: safeStr(((it.video_versions && it.video_versions[0] && it.video_versions[0].url) || it.video_url)),
        video_duration: safeNum(it.video_duration), expiring_at: safeNum(it.expiring_at),
        caption: it.caption ? safeStr(it.caption.text) : null, music: xMusic(it),
        taken_at: safeNum(it.taken_at_timestamp), thumbnail: safeStr(it.thumbnail_src),
        product_type: safeStr(it.product_type)
      };
    });
    return {
      id: safeStr(reel.id), title: safeStr(reel.title), item_count: items.length, items: items,
      cover: safeStr(reel.cover_media ? (reel.cover_media.cropped_image_version ? reel.cover_media.cropped_image_version.url : null) : null)
    };
  });
}

function xStories(u) {
  if (!u) return null;
  var hasStory = safeBool(u.has_public_story);
  var isLive = safeBool(u.is_live);
  var reel = u.reel || {};
  var items = [];
  if (reel.latest_reel_media) {
    var lrm = reel.latest_reel_media;
    items.push({
      id: safeStr(lrm.id), type: lrm.media_type === 2 ? "video" : "photo",
      display_url: safeStr(lrm.display_url), video_url: safeStr(lrm.video_url),
      video_duration: safeNum(lrm.video_duration), expiring_at: safeNum(reel.expiring_at),
      has_audio: safeBool(lrm.has_audio), music: xMusic(lrm),
      taken_at: safeNum(lrm.taken_at_timestamp),
      product_type: safeStr(lrm.product_type),
      viewer_count: safeNum(lrm.viewer_count)
    });
  }
  if (reel.items && Array.isArray(reel.items) && reel.items.length) {
    items = reel.items.map(function(it) {
      return {
        id: safeStr(it.id), type: it.media_type === 2 ? "video" : "photo",
        display_url: safeStr(it.display_url || ((it.image_versions2 && it.image_versions2.candidates && it.image_versions2.candidates[0] && it.image_versions2.candidates[0].url))),
        video_url: safeStr(it.video_url || ((it.video_versions && it.video_versions[0] && it.video_versions[0].url))),
        video_duration: safeNum(it.video_duration), expiring_at: safeNum(it.expiring_at || reel.expiring_at),
        has_audio: safeBool(it.has_audio), music: xMusic(it),
        taken_at: safeNum(it.taken_at_timestamp),
        product_type: safeStr(it.product_type),
        viewer_count: safeNum(it.viewer_count)
      };
    });
  }
  return { has_public_story: hasStory, is_live: isLive, expiring_at: safeNum(reel.expiring_at), id: safeStr(reel.id), items: items, items_count: items.length };
}

async function handle(req) {
  var u = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (u.pathname === "/" || u.pathname === "") {
    return j({ service: "Instagram Scraper v5.0", note: "Zero config. Copy, Paste, Deploy. Updated for 2026 API changes.", endpoints: { "/info?username=<name>": "Full profile + 12 posts (new fields: tagged_users, clips_music, ai_agent, fbid, etc)", "/info?username=<name>&posts=20&highlights=1&stories=1": "Everything with highlights & stories" } });
  }
  if (u.pathname !== "/info") return j({ error: "not_found" }, 404);

  var name = u.searchParams.get("username");
  if (!name) return j({ error: "missing_username", usage: "/info?username=<name>" }, 400);

  var postCount = Math.min(parseInt(u.searchParams.get("posts")) || 12, 50);
  var wantHL = u.searchParams.has("highlights");
  var wantST = u.searchParams.has("stories");

  try {
    var apiHeaders = await getApiHeaders(name);
    var r = await fetch("https://i.instagram.com/api/v1/users/web_profile_info/?username=" + encodeURIComponent(name), { headers: apiHeaders });
    var udata = null;

    if (r.status === 404) return j({ error: "not_found", username: name }, 404);

    if (!r.ok) {
      var htmlUid = "";
      try {
        var htmlR = await fetch("https://www.instagram.com/" + encodeURIComponent(name) + "/", { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
        if (htmlR.ok) { var htmlT = await htmlR.text(); var uidMatch = htmlT.match(/user_id["']?\s*[:=]\s*["']?(\d+)/); if (uidMatch) htmlUid = uidMatch[1]; }
      } catch (e) {}
      if (htmlUid) {
        try {
          var gqlR = await fetch("https://www.instagram.com/graphql/query/?query_id=9957820854288654&user_id=" + encodeURIComponent(htmlUid) + "&include_chaining=false&include_reel=true&include_suggested_users=false&include_logged_out_extras=true&include_live_status=false&include_highlight_reels=true", { headers: apiHeaders });
          if (gqlR.ok) { var gqlD = await gqlR.json(); if (gqlD && gqlD.data && gqlD.data.user) { udata = gqlD.data.user; } }
        } catch (e) {}
      }
      if (!udata) return j({ error: "instagram_http_error", code: r.status, username: name }, r.status);
    } else {
      var d = await r.json();
      udata = d && d.data && d.data.user;
    }

    if (udata && (!udata.edge_owner_to_timeline_media || !udata.edge_owner_to_timeline_media.edges)) {
      try {
        var uid2 = udata.pk || udata.id || udata.fbid;
        if (uid2) {
          var gqlR2 = await fetch("https://www.instagram.com/graphql/query/?query_id=9957820854288654&user_id=" + encodeURIComponent(uid2) + "&include_chaining=false&include_reel=true&include_suggested_users=false&include_logged_out_extras=true&include_live_status=false&include_highlight_reels=true", { headers: apiHeaders });
          if (gqlR2.ok) { var gqlD2 = await gqlR2.json(); if (gqlD2 && gqlD2.data && gqlD2.data.user) { udata = Object.assign({}, udata, gqlD2.data.user); } }
        }
      } catch (e) {}
    }

    if (!udata) return j({ error: "no_user_data" }, 500);

    var uid = udata.pk || udata.id;
    var edges = (udata.edge_owner_to_timeline_media && udata.edge_owner_to_timeline_media.edges) || [];
    var recent = edges.slice(0, postCount).map(function(x) { return xPost(x.node || x); });
    var profile = xProfile(udata);

    var result = Object.assign({}, profile, {
      recent_posts: recent, posts_fetched: recent.length,
      posts_total: safeNum(udata.edge_owner_to_timeline_media ? udata.edge_owner_to_timeline_media.count : null),
      has_more_posts: safeBool(udata.edge_owner_to_timeline_media && udata.edge_owner_to_timeline_media.page_info && udata.edge_owner_to_timeline_media.page_info.has_next_page),
      next_cursor: safeStr(udata.edge_owner_to_timeline_media && udata.edge_owner_to_timeline_media.page_info && udata.edge_owner_to_timeline_media.page_info.end_cursor)
    });

    if (wantHL || wantST) {
      try {
        var hlStR = await fetch("https://www.instagram.com/graphql/query/?query_id=9957820854288654&user_id=" + encodeURIComponent(uid) + "&include_chaining=false&include_reel=" + (wantST ? "true" : "false") + "&include_suggested_users=false&include_logged_out_extras=true&include_live_status=false&include_highlight_reels=" + (wantHL ? "true" : "false"), { headers: apiHeaders });
        if (hlStR.ok) { var hlStD = await hlStR.json(); if (hlStD && hlStD.data && hlStD.data.user) { var hlStU = hlStD.data.user; if (wantHL && hlStU.edge_highlight_reels) result.highlights = xHighlights(hlStU.edge_highlight_reels.edges); if (wantST && hlStU.reel) result.stories = xStories(hlStU); } }
      } catch (e) {}
    }

    result.fetched_at = new Date().toISOString();
    return j(result);

  } catch (e) {
    return j({ error: "fetch_failed", message: e.message }, 500);
  }
}

// src by @ftgamer2 🐱‍👤
