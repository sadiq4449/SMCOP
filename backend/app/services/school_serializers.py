from app.models.school import School
from app.schemas.school import SchoolDetail, SchoolSummary


def school_summary_from(school: School) -> SchoolSummary:
    uc = school.uc
    taluka = uc.taluka
    district = taluka.district
    partner = school.partner_org
    return SchoolSummary(
        id=str(school.id),
        emis_code=school.emis_code,
        name=school.name,
        uc_id=str(school.uc_id),
        district_name=district.name,
        taluka_name=taluka.name,
        uc_name=uc.name,
        level=school.level.value,
        gender=school.gender.value,
        partner_org_id=str(school.partner_org_id) if school.partner_org_id else None,
        partner_org_name=partner.name if partner else None,
        principal_name=school.principal_name,
        principal_phone=school.principal_phone,
        status=school.status.value,
    )


def school_detail_from(school: School) -> SchoolDetail:
    uc = school.uc
    taluka = uc.taluka
    district = taluka.district
    partner = school.partner_org
    return SchoolDetail(
        id=str(school.id),
        emis_code=school.emis_code,
        name=school.name,
        uc_id=str(school.uc_id),
        district_id=str(district.id),
        district_name=district.name,
        taluka_id=str(taluka.id),
        taluka_name=taluka.name,
        uc_name=uc.name,
        level=school.level.value,
        gender=school.gender.value,
        partner_org_id=str(school.partner_org_id) if school.partner_org_id else None,
        partner_org_name=partner.name if partner else None,
        principal_name=school.principal_name,
        principal_phone=school.principal_phone,
        gps_latitude=school.gps_latitude,
        gps_longitude=school.gps_longitude,
        status=school.status.value,
    )
