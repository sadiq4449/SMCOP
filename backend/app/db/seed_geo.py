from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.geography import District, Taluka, UnionCouncil
from app.models.partner_org import PartnerOrg
from app.models.school import (
    ActiveStatus,
    School,
    SchoolEnrollment,
    SchoolGender,
    SchoolLevel,
    Teacher,
    TeacherGender,
)


def seed_geography_and_partner(db: Session) -> None:
    if db.scalar(select(District.id).limit(1)):
        return

    district = District(name="District Alpha", code="DA-001")
    db.add(district)
    db.flush()

    taluka = Taluka(district_id=district.id, name="Taluka One")
    db.add(taluka)
    db.flush()

    uc_north = UnionCouncil(taluka_id=taluka.id, name="UC North")
    uc_south = UnionCouncil(taluka_id=taluka.id, name="UC South")
    db.add_all([uc_north, uc_south])
    db.flush()

    partner = PartnerOrg(
        name="PPP Partner Demo",
        contact_person="Partner Contact",
        email="partner@example.com",
        phone="+920000000000",
        address="Sindh, Pakistan",
    )
    db.add(partner)
    db.flush()

    school = School(
        emis_code="EMIS-DEMO-001",
        name="Govt. Primary School Demo",
        uc_id=uc_north.id,
        level=SchoolLevel.PRIMARY,
        gender=SchoolGender.MIXED,
        partner_org_id=partner.id,
        principal_name="Demo Principal",
        principal_phone="+921111111111",
        status=ActiveStatus.ACTIVE,
    )
    db.add(school)
    db.flush()

    db.add(
        SchoolEnrollment(
            school_id=school.id,
            quarter="Q1-2026",
            boys=120,
            girls=110,
            total=230,
        )
    )
    db.add(
        Teacher(
            school_id=school.id,
            name="Demo Teacher",
            gender=TeacherGender.MALE,
            subject="Mathematics",
            status=ActiveStatus.ACTIVE,
        )
    )

    db.commit()
